import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { buildSearchText, markdownForSecurityInspection } from "./markdown.mjs";
import { assertRelativeBundlePath, DEFAULT_LIMITS, OfflineDocsPolicyError, resolveInside } from "./policy.mjs";

const APP_STATUS = new Set(["imported", "empty", "unavailable"]);
const SOURCE_STATUS = new Set(["imported", "empty", "unavailable"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, code, message) {
  if (!condition) {
    throw new OfflineDocsPolicyError(code, message);
  }
}

function checkedGitHubUrl(value, expectedPrefix, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new OfflineDocsPolicyError("invalid-source-url", `${label} is not a valid URL`);
  }
  assert(url.protocol === "https:" && url.hostname.toLocaleLowerCase("en-US") === "github.com", "invalid-source-url", `${label} must use public GitHub HTTPS`);
  assert(!url.username && !url.password && !url.search && !url.hash, "credential-bearing-source-url", `${label} contains credentials, query data, or a fragment`);
  const pathname = url.pathname.toLocaleLowerCase("en-US");
  assert(pathname === expectedPrefix || pathname.startsWith(`${expectedPrefix}/`), "invalid-source-owner", `${label} does not belong to the curated repository`);
  return { url, pathname };
}

async function readJson(filePath, label) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    throw new OfflineDocsPolicyError("bundle-file-missing", `${label} is missing: ${error.message}`);
  }
  try {
    return { value: JSON.parse(raw), raw };
  } catch (error) {
    throw new OfflineDocsPolicyError("invalid-bundle-json", `${label} is invalid JSON: ${error.message}`);
  }
}

async function listBundleFiles(root) {
  const results = [];
  async function visit(directory, prefix = "") {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new OfflineDocsPolicyError("bundle-symlink", `Symlinks are forbidden in the offline bundle: ${relative}`);
      }
      if (entry.isDirectory()) {
        await visit(absolute, relative);
      } else if (entry.isFile()) {
        results.push(relative.replaceAll("\\", "/"));
      }
    }
  }
  await visit(root);
  return results;
}

function expectedCounts(apps, articles) {
  return {
    apps: apps.length,
    importedApps: apps.filter((app) => app.status === "imported").length,
    emptyApps: apps.filter((app) => app.status === "empty").length,
    unavailableApps: apps.filter((app) => app.status === "unavailable").length,
    articles: articles.length,
  };
}

export async function verifyOfflineDocsBundle({ catalogPath, bundleDir }) {
  const catalogResult = await readJson(catalogPath, "catalog");
  const manifestResult = await readJson(path.join(bundleDir, "manifest.json"), "offline documentation manifest");
  const catalog = catalogResult.value;
  const manifest = manifestResult.value;
  assert(catalog?.schemaVersion === 1 && Array.isArray(catalog.apps), "invalid-catalog", "Catalog schema is invalid");
  assert(catalog.organization === "Ding-Ding-Projects", "invalid-catalog", "Catalog organization is not supported");
  assert(manifest?.schemaVersion === 1 && Array.isArray(manifest.apps) && Array.isArray(manifest.articles), "invalid-manifest", "Manifest schema is invalid");
  const limitKeys = Object.keys(DEFAULT_LIMITS).sort();
  assert(
    manifest.limits && JSON.stringify(Object.keys(manifest.limits).sort()) === JSON.stringify(limitKeys),
    "invalid-manifest-limits",
    "Manifest limit schema is incomplete or contains unknown limits",
  );
  for (const key of limitKeys) {
    const value = manifest.limits[key];
    assert(
      Number.isSafeInteger(value) && value > 0 && value <= DEFAULT_LIMITS[key],
      "invalid-manifest-limits",
      `Manifest limit exceeds the supported ceiling: ${key}`,
    );
  }
  assert(
    manifest.catalog?.sha256 === sha256(catalogResult.raw),
    "catalog-digest-mismatch",
    "Manifest was not generated from the current curated catalog",
  );

  const expectedAppIds = catalog.apps.map((app) => app.id);
  assert(expectedAppIds.length <= manifest.limits.maxCatalogApps, "catalog-count-exceeded", "Catalog app count exceeds the declared limit");
  const actualAppIds = manifest.apps.map((app) => app.appId);
  assert(
    JSON.stringify(actualAppIds) === JSON.stringify(expectedAppIds),
    "catalog-app-coverage",
    "Every curated app must have exactly one ordered manifest record",
  );
  assert(new Set(actualAppIds).size === actualAppIds.length, "duplicate-app-record", "Manifest contains duplicate app records");

  const articleIds = new Set();
  const contentPaths = new Set();
  const articleByApp = new Map(expectedAppIds.map((appId) => [appId, []]));
  const contentById = new Map();
  let totalArticleBytes = 0;
  for (const article of manifest.articles) {
    assert(typeof article.id === "string" && !articleIds.has(article.id), "duplicate-article-id", `Duplicate article id: ${article.id}`);
    articleIds.add(article.id);
    assert(articleByApp.has(article.appId), "unknown-article-app", `Article belongs to an unknown app: ${article.appId}`);
    assert(article.source === "repository" || article.source === "wiki", "invalid-article-source", `Invalid article source: ${article.id}`);
    assert(/^[0-9a-f]{40,64}$/u.test(article.sourceCommitSha ?? ""), "invalid-article-sha", `Article is not pinned to a source SHA: ${article.id}`);
    assert(/^[0-9a-f]{40,64}$/u.test(article.sourceBlobSha ?? ""), "invalid-blob-sha", `Article is not bound to a Git blob OID: ${article.id}`);
    assert(typeof article.sourcePath === "string" && article.sourcePath.length <= manifest.limits.maxPathLength, "source-path-limit", `Article source path exceeds its limit: ${article.id}`);
    assert(Number.isSafeInteger(article.bytes) && article.bytes >= 0 && article.bytes <= manifest.limits.maxBytesPerFile, "article-size-limit", `Article exceeds its declared byte limit: ${article.id}`);
    totalArticleBytes += article.bytes;
    assert(totalArticleBytes <= manifest.limits.maxOutputBytes, "bundle-size-limit", "Article bundle exceeds its declared output-byte limit");
    const contentPath = assertRelativeBundlePath(article.contentPath);
    assert(!contentPaths.has(contentPath), "duplicate-content-path", `Duplicate article content path: ${contentPath}`);
    contentPaths.add(contentPath);
    const absolute = resolveInside(bundleDir, contentPath);
    let metadata;
    try {
      metadata = await lstat(absolute);
    } catch (error) {
      throw new OfflineDocsPolicyError("article-content-missing", `Bundled Markdown is missing for ${article.id}: ${error.message}`);
    }
    assert(metadata.isFile() && !metadata.isSymbolicLink(), "invalid-article-file", `Article content is not a regular file: ${article.id}`);
    const content = await readFile(absolute, "utf8");
    assert(Buffer.byteLength(content, "utf8") === article.bytes, "article-size-mismatch", `Article byte count drifted: ${article.id}`);
    assert(sha256(content) === article.sha256, "article-hash-mismatch", `Article hash drifted: ${article.id}`);
    const inspectableContent = markdownForSecurityInspection(content);
    assert(!/!\[[^\]]*\]\([^)]*\)|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*|\/?)>/iu.test(inspectableContent), "external-asset-reference", `Article can load an external asset or raw HTML: ${article.id}`);
    for (const target of article.internalLinks ?? []) {
      assert(typeof target === "string", "invalid-internal-link", `Article has an invalid internal link: ${article.id}`);
    }
    articleByApp.get(article.appId).push(article);
    contentById.set(article.id, content);
  }
  for (const article of manifest.articles) {
    for (const target of article.internalLinks ?? []) {
      assert(articleIds.has(target), "missing-link-target", `Article ${article.id} links to missing article ${target}`);
    }
  }

  for (const appRecord of manifest.apps) {
    assert(APP_STATUS.has(appRecord.status), "invalid-app-status", `App has no explicit import status: ${appRecord.appId}`);
    const catalogApp = catalog.apps.find((app) => app.id === appRecord.appId);
    assert(appRecord.repository === catalogApp.repository, "repository-mismatch", `Repository drifted for ${appRecord.appId}`);
    const expectedPrefix = `/${catalog.organization}/${catalogApp.repository}`.toLocaleLowerCase("en-US");
    const appArticles = articleByApp.get(appRecord.appId);
    assert(appRecord.articleCount === appArticles.length, "app-article-count-mismatch", `Article count drifted for ${appRecord.appId}`);
    assert(appRecord.sources && typeof appRecord.sources === "object", "source-record-missing", `Source records are missing for ${appRecord.appId}`);
    for (const sourceName of ["repository", "wiki"]) {
      const source = appRecord.sources[sourceName];
      assert(source && SOURCE_STATUS.has(source.status), "source-status-missing", `${sourceName} status is missing for ${appRecord.appId}`);
      const checkedSourceUrl = checkedGitHubUrl(source.sourceUrl, expectedPrefix, `${sourceName} source URL for ${appRecord.appId}`);
      const sourceArticles = appArticles.filter((article) => article.source === sourceName);
      assert(sourceArticles.length <= manifest.limits.maxFilesPerSource, "source-file-count-exceeded", `${sourceName} exceeds its file-count limit for ${appRecord.appId}`);
      assert(sourceArticles.length <= manifest.limits.maxTreeEntries, "source-tree-count-exceeded", `${sourceName} exceeds its tree-entry limit for ${appRecord.appId}`);
      assert(
        sourceArticles.reduce((total, article) => total + article.bytes, 0) <= manifest.limits.maxBytesPerSource,
        "source-total-size-exceeded",
        `${sourceName} exceeds its aggregate byte limit for ${appRecord.appId}`,
      );
      assert(source.articleCount === sourceArticles.length, "source-article-count-mismatch", `${sourceName} article count drifted for ${appRecord.appId}`);
      if (source.status === "imported") {
        assert(sourceArticles.length > 0 && /^[0-9a-f]{40,64}$/u.test(source.commitSha ?? ""), "imported-source-invalid", `Imported ${sourceName} source lacks articles or SHA for ${appRecord.appId}`);
        assert(sourceArticles.every((article) => article.sourceCommitSha === source.commitSha), "source-sha-mismatch", `${sourceName} article SHA drifted for ${appRecord.appId}`);
        const sha = source.commitSha.toLocaleLowerCase("en-US");
        if (sourceName === "repository") {
          assert(checkedSourceUrl.pathname === `${expectedPrefix}/tree/${sha}`, "unpinned-source-url", `Repository source URL is not pinned for ${appRecord.appId}`);
        } else {
          assert(checkedSourceUrl.pathname === `${expectedPrefix}/wiki`, "invalid-wiki-url", `Wiki source URL has an unexpected shape for ${appRecord.appId}`);
        }
      } else {
        assert(sourceArticles.length === 0, "nonimported-source-has-articles", `${sourceName} non-imported source still has articles for ${appRecord.appId}`);
        assert(typeof source.reasonCode === "string", "nonimported-source-invalid", `${sourceName} non-imported source lacks an explicit reason for ${appRecord.appId}`);
      }
    }

    for (const article of appArticles) {
      const checkedArticleUrl = checkedGitHubUrl(article.sourceUrl, expectedPrefix, `Article source URL for ${article.id}`);
      const sha = article.sourceCommitSha.toLocaleLowerCase("en-US");
      if (article.source === "repository") {
        const blobPrefix = `${expectedPrefix}/blob/${sha}/`;
        assert(checkedArticleUrl.pathname.startsWith(blobPrefix), "unpinned-source-url", `Article URL is not pinned for ${article.id}`);
        let decodedPath;
        try {
          decodedPath = decodeURIComponent(checkedArticleUrl.url.pathname.slice(blobPrefix.length));
        } catch {
          throw new OfflineDocsPolicyError("invalid-source-url", `Article URL has invalid path encoding: ${article.id}`);
        }
        assert(decodedPath === article.sourcePath, "article-source-path-mismatch", `Article URL path drifted for ${article.id}`);
      } else {
        assert(checkedArticleUrl.pathname.startsWith(`${expectedPrefix}/wiki/`), "invalid-wiki-url", `Wiki article URL has an unexpected shape for ${article.id}`);
      }
    }
    const expectedStatus = appArticles.length > 0
      ? "imported"
      : Object.values(appRecord.sources).some((source) => source.status === "unavailable")
        ? "unavailable"
        : "empty";
    assert(appRecord.status === expectedStatus, "app-status-mismatch", `Aggregate app status drifted for ${appRecord.appId}`);
  }

  const diskFiles = await listBundleFiles(bundleDir);
  const expectedFiles = new Set([...contentPaths, "manifest.json", "search-index.json"]);
  assert(
    JSON.stringify(diskFiles.sort()) === JSON.stringify([...expectedFiles].sort()),
    "bundle-file-completeness",
    "Bundle contains a missing or unexpected file",
  );

  assert(manifest.searchIndexPath === "search-index.json", "invalid-search-index-path", "Search index path must be deterministic");
  const search = (await readJson(path.join(bundleDir, manifest.searchIndexPath), "offline search index")).value;
  assert(search?.schemaVersion === 1 && Array.isArray(search.documents), "invalid-search-index", "Search index schema is invalid");
  assert(search.documents.length === manifest.articles.length, "search-index-count-mismatch", "Search index is incomplete");
  for (let index = 0; index < manifest.articles.length; index += 1) {
    const article = manifest.articles[index];
    const document = search.documents[index];
    assert(document?.id === article.id && document.appId === article.appId && document.title === article.title, "search-index-order", `Search document identity drifted at ${index}`);
    assert(document.text === buildSearchText(article.title, contentById.get(article.id)), "search-index-text-mismatch", `Search text drifted for ${article.id}`);
  }
  assert(JSON.stringify(manifest.counts) === JSON.stringify(expectedCounts(manifest.apps, manifest.articles)), "manifest-count-mismatch", "Manifest totals are inconsistent");
  return { appCount: manifest.apps.length, articleCount: manifest.articles.length, markdownFileCount: contentPaths.size };
}
