import { readFile } from "node:fs/promises";
import path from "node:path";

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
    // A manifest is not an authenticated provenance root. Reusing its sourceBlobSha
    // would let a modified cache relabel transformed bytes as a different upstream
    // blob. Re-fetch imported sources through the delegate so GitHub/provider checks
    // independently establish the original blob OID before any cache is reused.
    return delegate[sourceKind](app, limits);
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
