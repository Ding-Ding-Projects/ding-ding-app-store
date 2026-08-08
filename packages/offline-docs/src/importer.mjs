import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  articleId,
  articleOutputPath,
  buildSearchText,
  extractTitle,
  sanitizeAndRewriteMarkdown,
  sha256,
} from "./markdown.mjs";
import { VERIFIED_CACHE_ENTRY } from "./internal.mjs";
import {
  isRepositoryDocumentationPath,
  isWikiDocumentationPath,
  mergeLimits,
  normalizeSourcePath,
  OfflineDocsPolicyError,
  resolveInside,
} from "./policy.mjs";
import { verifyOfflineDocsBundle } from "./verify.mjs";

const APP_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const REPOSITORY_NAME = /^[A-Za-z0-9_.-]{1,100}$/u;
const COMMIT_SHA = /^[0-9a-f]{40,64}$/u;
const ALLOWED_SOURCE_STATUSES = new Set(["available", "empty", "unavailable"]);

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function catalogDigest(rawCatalog) {
  return createHash("sha256").update(rawCatalog).digest("hex");
}

function gitBlobOid(content, expectedLength) {
  const bytes = Buffer.from(content, "utf8");
  const header = Buffer.from(`blob ${bytes.byteLength}\u0000`, "utf8");
  const algorithm = expectedLength === 64 ? "sha256" : "sha1";
  return createHash(algorithm).update(header).update(bytes).digest("hex");
}

function validateCatalog(catalog, limits) {
  if (catalog?.schemaVersion !== 1 || catalog.organization !== "Ding-Ding-Projects" || !Array.isArray(catalog.apps)) {
    throw new OfflineDocsPolicyError("invalid-catalog", "Catalog must be Ding-Ding-Projects schema version 1");
  }
  if (catalog.apps.length > limits.maxCatalogApps) {
    throw new OfflineDocsPolicyError("catalog-count-exceeded", "Catalog exceeds its configured app limit");
  }
  const appIds = new Set();
  const repositories = new Set();
  for (const app of catalog.apps) {
    if (!APP_ID.test(app.id ?? "") || !REPOSITORY_NAME.test(app.repository ?? "") || typeof app.displayName !== "string") {
      throw new OfflineDocsPolicyError("invalid-catalog-app", "Catalog app is missing a safe id, repository, or display name");
    }
    const repoKey = app.repository.toLocaleLowerCase("en-US");
    if (appIds.has(app.id) || repositories.has(repoKey)) {
      throw new OfflineDocsPolicyError("duplicate-catalog-app", `Duplicate catalog app or repository: ${app.id}`);
    }
    appIds.add(app.id);
    repositories.add(repoKey);
  }
}

function sourceUnavailable(sourceUrl, reasonCode, detail = null) {
  return { status: "unavailable", sourceUrl, commitSha: null, reasonCode, detail, articleCount: 0 };
}

function validateSourceSnapshot(snapshot, sourceKind, limits, app, organization) {
  if (!snapshot || !ALLOWED_SOURCE_STATUSES.has(snapshot.status) || !Array.isArray(snapshot.files)) {
    throw new OfflineDocsPolicyError("invalid-source-snapshot", `${sourceKind} provider returned an invalid snapshot`);
  }
  let url;
  try {
    url = new URL(snapshot.sourceUrl);
  } catch {
    throw new OfflineDocsPolicyError("invalid-source-url", `${sourceKind} source URL is invalid`);
  }
  if (url.protocol !== "https:" || url.hostname.toLocaleLowerCase("en-US") !== "github.com") {
    throw new OfflineDocsPolicyError("invalid-source-url", `${sourceKind} source must use public GitHub HTTPS`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new OfflineDocsPolicyError("credential-bearing-source-url", `${sourceKind} source URL contains credentials, query data, or a fragment`);
  }
  const expectedPrefix = `/${organization}/${app.repository}`.toLocaleLowerCase("en-US");
  const sourcePathname = url.pathname.toLocaleLowerCase("en-US");
  if (sourcePathname !== expectedPrefix && !sourcePathname.startsWith(`${expectedPrefix}/`)) {
    throw new OfflineDocsPolicyError("invalid-source-owner", `${sourceKind} source URL does not belong to the curated repository`);
  }
  if (snapshot.status !== "available") {
    if (snapshot.files.length !== 0) {
      throw new OfflineDocsPolicyError("invalid-source-snapshot", `${sourceKind} unavailable/empty source included files`);
    }
    if (snapshot.commitSha !== null && !COMMIT_SHA.test(snapshot.commitSha)) {
      throw new OfflineDocsPolicyError("invalid-source-sha", `${sourceKind} returned an invalid commit SHA`);
    }
    return [];
  }
  if (!COMMIT_SHA.test(snapshot.commitSha ?? "")) {
    throw new OfflineDocsPolicyError("invalid-source-sha", `${sourceKind} source is not pinned to a commit SHA`);
  }
  if (snapshot.files.length > limits.maxFilesPerSource) {
    throw new OfflineDocsPolicyError("source-file-count-exceeded", `${sourceKind} exceeds its file-count limit`);
  }
  let totalBytes = 0;
  const paths = new Set();
  return snapshot.files
    .map((file) => {
      const sourcePath = normalizeSourcePath(file.path, limits.maxPathLength);
      const acceptedPath = sourceKind === "repository"
        ? isRepositoryDocumentationPath(sourcePath)
        : isWikiDocumentationPath(sourcePath);
      if (!acceptedPath) {
        throw new OfflineDocsPolicyError("source-path-out-of-scope", `${sourceKind} returned an out-of-scope file: ${sourcePath}`);
      }
      if (typeof file.content !== "string" || file.content.includes("\u0000")) {
        throw new OfflineDocsPolicyError("invalid-markdown-content", `${sourceKind} returned invalid Markdown content: ${sourcePath}`);
      }
      if (!/^[0-9a-f]{40,64}$/u.test(file.blobSha ?? "")) {
        throw new OfflineDocsPolicyError("invalid-blob-sha", `${sourceKind} file lacks a valid Git blob OID: ${sourcePath}`);
      }
      const blobSha = file.blobSha;
      if (file[VERIFIED_CACHE_ENTRY] === true) {
        if (
          !file.cachedArticle ||
          file.cachedArticle.sourceBlobSha !== blobSha ||
          sha256(file.content) !== file.cachedArticle.sha256
        ) {
          throw new OfflineDocsPolicyError("invalid-cache-proof", `Cached article proof failed: ${sourcePath}`);
        }
      } else if (gitBlobOid(file.content, blobSha.length) !== blobSha) {
        throw new OfflineDocsPolicyError("blob-content-mismatch", `${sourceKind} bytes do not match their Git blob OID: ${sourcePath}`);
      }
      let fileUrl;
      try {
        fileUrl = new URL(file.sourceUrl);
      } catch {
        throw new OfflineDocsPolicyError("invalid-source-url", `${sourceKind} file URL is invalid: ${sourcePath}`);
      }
      if (fileUrl.protocol !== "https:" || fileUrl.hostname.toLocaleLowerCase("en-US") !== "github.com") {
        throw new OfflineDocsPolicyError("invalid-source-url", `${sourceKind} file URL must use public GitHub HTTPS: ${sourcePath}`);
      }
      if (fileUrl.username || fileUrl.password || fileUrl.search || fileUrl.hash) {
        throw new OfflineDocsPolicyError("credential-bearing-source-url", `${sourceKind} file URL contains credentials, query data, or a fragment: ${sourcePath}`);
      }
      const filePathname = fileUrl.pathname.toLocaleLowerCase("en-US");
      if (filePathname !== expectedPrefix && !filePathname.startsWith(`${expectedPrefix}/`)) {
        throw new OfflineDocsPolicyError("invalid-source-owner", `${sourceKind} file URL does not belong to the curated repository: ${sourcePath}`);
      }
      if (sourceKind === "repository") {
        const sha = snapshot.commitSha.toLocaleLowerCase("en-US");
        if (sourcePathname !== `${expectedPrefix}/tree/${sha}` || !filePathname.startsWith(`${expectedPrefix}/blob/${sha}/`)) {
          throw new OfflineDocsPolicyError("unpinned-source-url", `Repository URL is not pinned to its source SHA: ${sourcePath}`);
        }
      }
      const bytes = Buffer.byteLength(file.content ?? "", "utf8");
      if (!Number.isSafeInteger(file.size) || file.size !== bytes || bytes > limits.maxBytesPerFile) {
        throw new OfflineDocsPolicyError("source-file-size-exceeded", `${sourceKind} file violates its byte limit: ${sourcePath}`);
      }
      totalBytes += bytes;
      if (totalBytes > limits.maxBytesPerSource) {
        throw new OfflineDocsPolicyError("source-total-size-exceeded", `${sourceKind} exceeds its aggregate byte limit`);
      }
      const key = sourcePath.toLocaleLowerCase("en-US");
      if (paths.has(key)) {
        throw new OfflineDocsPolicyError("duplicate-source-path", `${sourceKind} has duplicate path: ${sourcePath}`);
      }
      paths.add(key);
      return { ...file, path: sourcePath, blobSha };
    })
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function collectSource(providerMethod, app, sourceKind, limits, organization) {
  try {
    const snapshot = await providerMethod(app, limits);
    const files = validateSourceSnapshot(snapshot, sourceKind, limits, app, organization);
    return { snapshot, files };
  } catch (error) {
    const fallback = `https://github.com/Ding-Ding-Projects/${encodeURIComponent(app.repository)}${sourceKind === "wiki" ? "/wiki" : ""}`;
    return {
      snapshot: {
        status: "unavailable",
        sourceUrl: fallback,
        commitSha: null,
        reasonCode: error.code || "source-policy-rejected",
        detail: error.message,
        files: [],
      },
      files: [],
    };
  }
}

function sourceRecord(snapshot, articleCount) {
  const status = articleCount > 0 ? "imported" : snapshot.status === "unavailable" ? "unavailable" : "empty";
  return {
    status,
    commitSha: snapshot.commitSha,
    sourceUrl: snapshot.sourceUrl,
    articleCount,
    reasonCode: status === "imported" ? null : snapshot.reasonCode ?? "no-markdown-documentation",
  };
}

export async function importOfflineDocs({ catalogPath, outputDir, sourceProvider, limits: limitOverrides = {} }) {
  const limits = mergeLimits(limitOverrides);
  const rawCatalog = await readFile(catalogPath, "utf8");
  const catalog = JSON.parse(rawCatalog);
  validateCatalog(catalog, limits);
  if (!sourceProvider?.repository || !sourceProvider?.wiki) {
    throw new OfflineDocsPolicyError("invalid-provider", "Source provider must implement repository and wiki methods");
  }

  const collectedApps = [];
  for (const app of catalog.apps) {
    const repository = await collectSource(sourceProvider.repository.bind(sourceProvider), app, "repository", limits, catalog.organization);
    const wiki = await collectSource(sourceProvider.wiki.bind(sourceProvider), app, "wiki", limits, catalog.organization);
    collectedApps.push({ app, repository, wiki });
  }

  const systemicReasons = new Set([
    "repository-unavailable",
    "repository-clone-failed",
    "commit-unavailable",
    "source-timeout",
    "source-unavailable",
  ]);
  if (
    collectedApps.length > 0 &&
    collectedApps.every(({ repository }) =>
      repository.snapshot.status === "unavailable" && systemicReasons.has(repository.snapshot.reasonCode))
  ) {
    throw new OfflineDocsPolicyError(
      "provider-systemic-outage",
      "Every curated repository was unavailable through the same provider path; existing output was preserved",
    );
  }

  const draftArticles = [];
  const pathMaps = new Map();
  for (const collected of collectedApps) {
    for (const [sourceKind, source] of [["repository", collected.repository], ["wiki", collected.wiki]]) {
      const map = new Map();
      for (const file of source.files) {
        const id = articleId(collected.app.id, sourceKind, file.path);
        map.set(file.path, id);
        map.set(file.path.toLocaleLowerCase("en-US"), id);
        draftArticles.push({ app: collected.app, sourceKind, snapshot: source.snapshot, file, id });
      }
      pathMaps.set(`${collected.app.id}:${sourceKind}`, map);
    }
  }

  const articles = [];
  const contentFiles = [];
  let outputBytes = 0;
  for (const draft of draftArticles.sort((left, right) => left.id.localeCompare(right.id, "en"))) {
    const cached = draft.file.cachedArticle;
    const title = cached?.title ?? extractTitle(draft.file.content, draft.file.path);
    const rewritten = cached
      ? {
          content: draft.file.content,
          internalLinks: cached.internalLinks,
          redactionCount: cached.redactionCount,
          omittedAssetCount: cached.omittedAssetCount,
          blockedLinkCount: cached.blockedLinkCount,
        }
      : sanitizeAndRewriteMarkdown(draft.file.content, {
          owner: catalog.organization,
          repository: draft.app.repository,
          currentPath: draft.file.path,
          sourceKind: draft.sourceKind,
          pathMaps: {
            repository: pathMaps.get(`${draft.app.id}:repository`),
            wiki: pathMaps.get(`${draft.app.id}:wiki`),
          },
        });
    const contentPath = articleOutputPath(draft.app.id, draft.sourceKind, draft.file.path);
    const bytes = Buffer.byteLength(rewritten.content, "utf8");
    outputBytes += bytes;
    if (outputBytes > limits.maxOutputBytes) {
      throw new OfflineDocsPolicyError("bundle-size-exceeded", "Generated offline documentation exceeds its byte limit");
    }
    contentFiles.push({ contentPath, content: rewritten.content });
    articles.push({
      id: draft.id,
      appId: draft.app.id,
      source: draft.sourceKind,
      title,
      sourcePath: draft.file.path,
      sourceUrl: draft.file.sourceUrl,
      sourceCommitSha: draft.snapshot.commitSha,
      sourceBlobSha: draft.file.blobSha,
      contentPath,
      bytes,
      sha256: sha256(rewritten.content),
      internalLinks: rewritten.internalLinks,
      redactionCount: rewritten.redactionCount,
      omittedAssetCount: rewritten.omittedAssetCount,
      blockedLinkCount: rewritten.blockedLinkCount,
    });
  }

  const apps = collectedApps.map((collected) => {
    const repositoryCount = articles.filter((article) => article.appId === collected.app.id && article.source === "repository").length;
    const wikiCount = articles.filter((article) => article.appId === collected.app.id && article.source === "wiki").length;
    const total = repositoryCount + wikiCount;
    const repositoryRecord = sourceRecord(collected.repository.snapshot, repositoryCount);
    const wikiRecord = sourceRecord(collected.wiki.snapshot, wikiCount);
    return {
      appId: collected.app.id,
      repository: collected.app.repository,
      displayName: collected.app.displayName,
      status: total > 0 ? "imported" : repositoryRecord.status === "unavailable" || wikiRecord.status === "unavailable" ? "unavailable" : "empty",
      articleCount: total,
      sources: { repository: repositoryRecord, wiki: wikiRecord },
    };
  });

  const searchIndex = {
    schemaVersion: 1,
    documents: articles.map((article) => {
      const content = contentFiles.find((candidate) => candidate.contentPath === article.contentPath).content;
      return {
        id: article.id,
        appId: article.appId,
        title: article.title,
        text: buildSearchText(article.title, content),
      };
    }),
  };
  const counts = {
    apps: apps.length,
    importedApps: apps.filter((app) => app.status === "imported").length,
    emptyApps: apps.filter((app) => app.status === "empty").length,
    unavailableApps: apps.filter((app) => app.status === "unavailable").length,
    articles: articles.length,
  };
  const manifest = {
    schemaVersion: 1,
    catalog: { path: "data/catalog.v1.json", sha256: catalogDigest(rawCatalog) },
    limits,
    counts,
    searchIndexPath: "search-index.json",
    apps,
    articles,
  };

  const resolvedOutput = path.resolve(outputDir);
  const parent = path.dirname(resolvedOutput);
  const temporary = path.join(parent, `.${path.basename(resolvedOutput)}.tmp-${process.pid}`);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  try {
    for (const file of contentFiles) {
      const destination = resolveInside(temporary, file.contentPath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.content, "utf8");
    }
    await writeFile(path.join(temporary, "search-index.json"), stableJson(searchIndex), "utf8");
    await writeFile(path.join(temporary, "manifest.json"), stableJson(manifest), "utf8");
    await verifyOfflineDocsBundle({ catalogPath, bundleDir: temporary });
    await rm(resolvedOutput, { recursive: true, force: true });
    await rename(temporary, resolvedOutput);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
  return manifest;
}
