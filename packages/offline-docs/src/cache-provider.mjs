import { readFile } from "node:fs/promises";
import path from "node:path";

import { VERIFIED_CACHE_ENTRY } from "./internal.mjs";
import { resolveInside } from "./policy.mjs";

const TRANSIENT_REASONS = new Set([
  "repository-unavailable",
  "repository-clone-failed",
  "commit-unavailable",
  "repository-import-failed",
  "wiki-clone-failed",
  "wiki-import-failed",
  "source-unavailable",
  "source-timeout",
  "source-blob-read-failed",
]);

export async function createBundleResumeProvider({ bundleDir, delegate }) {
  const manifest = JSON.parse(await readFile(path.join(bundleDir, "manifest.json"), "utf8"));
  const appRecords = new Map(manifest.apps.map((record) => [record.appId, record]));

  async function source(app, sourceKind, limits) {
    const appRecord = appRecords.get(app.id);
    const sourceRecord = appRecord?.sources?.[sourceKind];
    if (!sourceRecord || (sourceRecord.status === "unavailable" && TRANSIENT_REASONS.has(sourceRecord.reasonCode))) {
      return delegate[sourceKind](app, limits);
    }
    if (sourceRecord.status !== "imported") {
      return {
        status: sourceRecord.status,
        sourceUrl: sourceRecord.sourceUrl,
        commitSha: sourceRecord.commitSha,
        reasonCode: sourceRecord.reasonCode,
        files: [],
      };
    }
    const articles = manifest.articles.filter(
      (article) => article.appId === app.id && article.source === sourceKind,
    );
    const files = [];
    for (const article of articles) {
      const content = await readFile(resolveInside(bundleDir, article.contentPath), "utf8");
      files.push({
        path: article.sourcePath,
        size: Buffer.byteLength(content, "utf8"),
        content,
        sourceUrl: article.sourceUrl,
        cachedArticle: article,
        blobSha: article.sourceBlobSha,
        [VERIFIED_CACHE_ENTRY]: true,
      });
    }
    return {
      status: "available",
      sourceUrl: sourceRecord.sourceUrl,
      commitSha: sourceRecord.commitSha,
      reasonCode: null,
      files,
    };
  }

  return {
    repository(app, limits) {
      return source(app, "repository", limits);
    },
    wiki(app, limits) {
      return source(app, "wiki", limits);
    },
  };
}
