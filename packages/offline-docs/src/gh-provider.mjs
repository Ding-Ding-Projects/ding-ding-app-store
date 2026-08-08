import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  isRepositoryDocumentationPath,
  isWikiDocumentationPath,
  normalizeSourcePath,
  OfflineDocsPolicyError,
} from "./policy.mjs";

const execFileAsync = promisify(execFile);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

async function runFile(command, args, options = {}) {
  const {
    deadline = Number.POSITIVE_INFINITY,
    timeoutMs = 60_000,
    ...execOptions
  } = options;
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new OfflineDocsPolicyError("source-timeout", `Source exceeded its time bound before ${command} could start`);
  }
  return execFileAsync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: Math.max(1, Math.min(timeoutMs, remaining)),
    killSignal: "SIGKILL",
    windowsHide: true,
    ...execOptions,
  });
}

async function ghJson(endpoint, options) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { stdout } = await runFile("gh", ["api", endpoint, "--method", "GET"], options);
      return JSON.parse(stdout);
    } catch (error) {
      const detail = `${error.stderr ?? ""} ${error.message}`;
      const transient = /rate limit|secondary rate|HTTP 5\d\d|timed?out|ECONNRESET|ETIMEDOUT/iu.test(detail);
      if (attempt > 0 || !transient) {
        throw error;
      }
      const remaining = (options?.deadline ?? Number.POSITIVE_INFINITY) - Date.now();
      if (remaining <= 1_000) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new OfflineDocsPolicyError("source-unavailable", "GitHub request retry was exhausted");
}

function unavailable(sourceUrl, reasonCode, detail) {
  const stableReason = typeof reasonCode === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(reasonCode)
    ? reasonCode
    : "source-unavailable";
  return { status: "unavailable", sourceUrl, commitSha: null, reasonCode: stableReason, detail, files: [] };
}

function empty(sourceUrl, commitSha, reasonCode) {
  return { status: "empty", sourceUrl, commitSha, reasonCode, files: [] };
}

function asUtf8(buffer, sourcePath) {
  try {
    return UTF8_DECODER.decode(buffer);
  } catch {
    throw new OfflineDocsPolicyError("non-utf8-markdown", `Markdown is not valid UTF-8: ${sourcePath}`);
  }
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

function checkCandidateBounds(candidates, limits) {
  if (candidates.length > limits.maxFilesPerSource) {
    throw new OfflineDocsPolicyError(
      "source-file-count-exceeded",
      `Source has ${candidates.length} Markdown files; limit is ${limits.maxFilesPerSource}`,
    );
  }
  let total = 0;
  for (const candidate of candidates) {
    if (!Number.isSafeInteger(candidate.size) || candidate.size < 0 || candidate.size > limits.maxBytesPerFile) {
      throw new OfflineDocsPolicyError("source-file-size-exceeded", `Markdown exceeds its byte limit: ${candidate.path}`);
    }
    total += candidate.size;
    if (total > limits.maxBytesPerSource) {
      throw new OfflineDocsPolicyError("source-total-size-exceeded", "Markdown source exceeds its aggregate byte limit");
    }
  }
}

function parseGitTree(output, limits, acceptsPath, label) {
  const records = output.split("\u0000").filter(Boolean);
  if (records.length > limits.maxTreeEntries) {
    throw new OfflineDocsPolicyError("source-tree-count-exceeded", `${label} tree exceeds its entry limit`);
  }
  const candidates = [];
  for (const record of records) {
    const match = record.match(/^([0-7]{6}) (blob|tree|commit) ([0-9a-f]{40,64})\t([\s\S]+)$/u);
    if (!match) {
      throw new OfflineDocsPolicyError("invalid-source-tree", `${label} tree contains an invalid entry`);
    }
    const [, mode, type, sha, rawPath] = match;
    if (type !== "blob" || mode === "120000") {
      continue;
    }
    const sourcePath = normalizeSourcePath(rawPath, limits.maxPathLength);
    if (acceptsPath(sourcePath)) {
      candidates.push({ path: sourcePath, sha });
    }
  }
  candidates.sort((left, right) => left.path.localeCompare(right.path, "en"));
  if (candidates.length > limits.maxFilesPerSource) {
    throw new OfflineDocsPolicyError(
      "source-file-count-exceeded",
      `Source has ${candidates.length} Markdown files; limit is ${limits.maxFilesPerSource}`,
    );
  }
  return candidates;
}

async function readSelectedGitBlobs({ checkout, candidates, limits, deadline, sourceUrlFor }) {
  const files = [];
  let totalBytes = 0;
  for (const candidate of candidates) {
    let bytes;
    try {
      ({ stdout: bytes } = await runFile(
        "git",
        ["-C", checkout, "cat-file", "blob", candidate.sha],
        {
          deadline,
          timeoutMs: limits.maxCommandDurationMs,
          encoding: null,
          maxBuffer: limits.maxBytesPerFile + 1,
        },
      ));
    } catch (error) {
      throw new OfflineDocsPolicyError(
        "source-blob-read-failed",
        `Selected Markdown could not be read within the command and file bounds: ${candidate.path}: ${error.message}`,
      );
    }
    if (!Buffer.isBuffer(bytes) || bytes.byteLength > limits.maxBytesPerFile) {
      throw new OfflineDocsPolicyError("source-file-size-exceeded", `Markdown exceeds its byte limit: ${candidate.path}`);
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > limits.maxBytesPerSource) {
      throw new OfflineDocsPolicyError("source-total-size-exceeded", "Markdown source exceeds its aggregate byte limit");
    }
    files.push({
      path: candidate.path,
      size: bytes.byteLength,
      content: asUtf8(bytes, candidate.path),
      sourceUrl: sourceUrlFor(candidate.path),
      blobSha: candidate.sha,
    });
  }
  return files;
}

export function createGitHubSourceProvider({ owner = "Ding-Ding-Projects" } = {}) {
  const repositoryMetadata = new Map();

  async function metadataFor(repository, deadline, limits) {
    if (!repositoryMetadata.has(repository)) {
      repositoryMetadata.set(
        repository,
        await ghJson(`repos/${owner}/${repository}`, { deadline, timeoutMs: limits.maxCommandDurationMs }),
      );
    }
    return repositoryMetadata.get(repository);
  }

  return {
    async repository(app, limits) {
      const deadline = Date.now() + limits.maxSourceDurationMs;
      const sourceUrl = `https://github.com/${owner}/${app.repository}`;
      let metadata;
      try {
        metadata = await metadataFor(app.repository, deadline, limits);
      } catch (error) {
        return unavailable(sourceUrl, "repository-unavailable", error.stderr?.trim() || error.message);
      }
      if (metadata.private || metadata.visibility !== "public") {
        return unavailable(sourceUrl, "private-repository", "Only public repositories may be imported");
      }
      if (!metadata.default_branch) {
        return empty(sourceUrl, null, "empty-repository");
      }

      if (metadata.size === 0) {
        return empty(sourceUrl, null, "empty-repository");
      }
      try {
        const commit = await ghJson(
          `repos/${owner}/${app.repository}/commits/${encodeURIComponent(metadata.default_branch)}`,
          { deadline, timeoutMs: limits.maxCommandDurationMs },
        );
        const commitSha = commit.sha;
        const treeSha = commit.commit?.tree?.sha;
        if (!/^[0-9a-f]{40,64}$/u.test(commitSha ?? "") || !/^[0-9a-f]{40,64}$/u.test(treeSha ?? "")) {
          throw new OfflineDocsPolicyError("invalid-source-sha", "Repository returned an invalid Git commit or tree SHA");
        }
        const tree = await ghJson(
          `repos/${owner}/${app.repository}/git/trees/${treeSha}?recursive=1`,
          { deadline, timeoutMs: limits.maxCommandDurationMs },
        );
        if (tree.truncated) {
          throw new OfflineDocsPolicyError("source-tree-truncated", "Repository tree response was truncated");
        }
        if (!Array.isArray(tree.tree) || tree.tree.length > limits.maxTreeEntries) {
          throw new OfflineDocsPolicyError("source-tree-count-exceeded", "Repository tree exceeds its entry limit");
        }
        const candidates = tree.tree
          .filter((entry) => entry.type === "blob" && isRepositoryDocumentationPath(entry.path))
          .map((entry) => ({ path: normalizeSourcePath(entry.path), size: entry.size, sha: entry.sha }))
          .sort((left, right) => left.path.localeCompare(right.path, "en"));
        checkCandidateBounds(candidates, limits);
        if (candidates.length === 0) {
          return empty(`${sourceUrl}/tree/${commitSha}`, commitSha, "no-markdown-documentation");
        }
        const files = await mapWithConcurrency(candidates, 2, async (candidate) => {
          const blob = await ghJson(
            `repos/${owner}/${app.repository}/git/blobs/${candidate.sha}`,
            { deadline, timeoutMs: limits.maxCommandDurationMs },
          );
          if (blob.encoding !== "base64" || typeof blob.content !== "string") {
            throw new OfflineDocsPolicyError("invalid-blob-encoding", `Unexpected blob encoding: ${candidate.path}`);
          }
          const bytes = Buffer.from(blob.content.replace(/\s+/gu, ""), "base64");
          if (bytes.byteLength !== candidate.size || bytes.byteLength > limits.maxBytesPerFile) {
            throw new OfflineDocsPolicyError("source-file-size-mismatch", `Blob size mismatch: ${candidate.path}`);
          }
          return {
            path: candidate.path,
            size: bytes.byteLength,
            content: asUtf8(bytes, candidate.path),
            sourceUrl: `${sourceUrl}/blob/${commitSha}/${candidate.path.split("/").map(encodeURIComponent).join("/")}`,
            blobSha: candidate.sha,
          };
        });
        return {
          status: "available",
          sourceUrl: `${sourceUrl}/tree/${commitSha}`,
          commitSha,
          reasonCode: null,
          files,
        };
      } catch (error) {
        return unavailable(sourceUrl, error.code || "repository-import-failed", error.message);
      }
    },

    async wiki(app, limits) {
      const deadline = Date.now() + limits.maxSourceDurationMs;
      const sourceUrl = `https://github.com/${owner}/${app.repository}/wiki`;
      if (app.wiki !== true) {
        return empty(sourceUrl, null, "wiki-not-requested");
      }
      try {
        const metadata = await metadataFor(app.repository, deadline, limits);
        if (metadata.private || metadata.visibility !== "public") {
          return unavailable(sourceUrl, "private-repository", "Only public repositories may be imported");
        }
      } catch (error) {
        return unavailable(sourceUrl, "repository-unavailable", error.stderr?.trim() || error.message);
      }

      const scratchRoot = await mkdtemp(path.join(os.tmpdir(), "ding-ding-offline-wiki-"));
      const checkout = path.join(scratchRoot, "wiki");
      try {
        try {
          await runFile(
            "gh",
            [
              "repo",
              "clone",
              `https://github.com/${owner}/${app.repository}.wiki.git`,
              checkout,
              "--",
              "--depth=1",
              "--filter=blob:none",
              "--no-checkout",
              "--quiet",
            ],
            { deadline, timeoutMs: limits.maxCommandDurationMs },
          );
        } catch (error) {
          const detail = `${error.stderr ?? ""} ${error.message}`;
          if (/repository not found|not found|does not exist/iu.test(detail)) {
            return empty(sourceUrl, null, "wiki-not-found");
          }
          return unavailable(sourceUrl, "wiki-clone-failed", detail.trim());
        }
        const { stdout: commitOutput } = await runFile(
          "git",
          ["-C", checkout, "rev-parse", "HEAD"],
          { deadline, timeoutMs: limits.maxCommandDurationMs },
        );
        const commitSha = commitOutput.trim();
        if (!/^[0-9a-f]{40,64}$/u.test(commitSha)) {
          throw new OfflineDocsPolicyError("invalid-source-sha", "Wiki returned an invalid Git commit SHA");
        }
        let treeOutput;
        try {
          ({ stdout: treeOutput } = await runFile(
            "git",
            ["-C", checkout, "ls-tree", "-r", "-z", "HEAD"],
            {
              deadline,
              timeoutMs: limits.maxCommandDurationMs,
              maxBuffer: Math.min(64 * 1024 * 1024, limits.maxTreeEntries * (limits.maxPathLength + 100)),
            },
          ));
        } catch (error) {
          throw new OfflineDocsPolicyError("source-tree-count-exceeded", `Wiki tree could not be read within its bound: ${error.message}`);
        }
        const candidates = parseGitTree(treeOutput, limits, isWikiDocumentationPath, "Wiki");
        if (candidates.length === 0) {
          return empty(sourceUrl, commitSha, "no-markdown-documentation");
        }
        const files = await readSelectedGitBlobs({
          checkout,
          candidates,
          limits,
          deadline,
          sourceUrlFor: (sourcePath) =>
            `${sourceUrl}/${encodeURIComponent(path.posix.basename(sourcePath, ".md"))}`,
        });
        return { status: "available", sourceUrl, commitSha, reasonCode: null, files };
      } catch (error) {
        return unavailable(sourceUrl, error.code || "wiki-import-failed", error.message);
      } finally {
        await rm(scratchRoot, { recursive: true, force: true });
      }
    },
  };
}
