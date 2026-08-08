import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createBundleResumeProvider,
  importOfflineDocs,
  isRepositoryDocumentationPath,
  normalizeSourcePath,
  OfflineDocsPolicyError,
  verifyOfflineDocsBundle,
} from "../src/index.mjs";

const REPOSITORY_SHA = "a".repeat(40);
const WIKI_SHA = "b".repeat(40);

function app(id = "sample-app", repository = "sample-app", displayName = "Sample App") {
  return { id, repository, displayName, wiki: true };
}

function sourceUrl(repository, kind) {
  return kind === "wiki"
    ? `https://github.com/Ding-Ding-Projects/${repository}/wiki`
    : `https://github.com/Ding-Ding-Projects/${repository}/tree/${REPOSITORY_SHA}`;
}

function available(repository, kind, files) {
  const commitSha = kind === "wiki" ? WIKI_SHA : REPOSITORY_SHA;
  return {
    status: "available",
    sourceUrl: sourceUrl(repository, kind),
    commitSha,
    reasonCode: null,
    files: files.map((file) => ({
      ...file,
      size: Buffer.byteLength(file.content, "utf8"),
      blobSha: createHash("sha1")
        .update(Buffer.from(`blob ${Buffer.byteLength(file.content, "utf8")}\u0000`, "utf8"))
        .update(Buffer.from(file.content, "utf8"))
        .digest("hex"),
      sourceUrl: kind === "wiki"
        ? `${sourceUrl(repository, kind)}/${encodeURIComponent(file.path)}`
        : `https://github.com/Ding-Ding-Projects/${repository}/blob/${commitSha}/${file.path.split("/").map(encodeURIComponent).join("/")}`,
    })),
  };
}

function empty(repository, kind, reasonCode = kind === "wiki" ? "wiki-not-found" : "empty-repository") {
  return { status: "empty", sourceUrl: sourceUrl(repository, kind), commitSha: null, reasonCode, files: [] };
}

function fixtureProvider({ repositories = new Map(), wikis = new Map() } = {}) {
  return {
    async repository(catalogApp) {
      return repositories.get(catalogApp.id) ?? empty(catalogApp.repository, "repository");
    },
    async wiki(catalogApp) {
      return wikis.get(catalogApp.id) ?? empty(catalogApp.repository, "wiki");
    },
  };
}

async function fixture(catalogApps, provider, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "offline-docs-test-"));
  const catalogPath = path.join(root, "catalog.json");
  const outputDir = path.join(root, "bundle");
  const catalog = { schemaVersion: 1, organization: "Ding-Ding-Projects", apps: catalogApps };
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const manifest = await importOfflineDocs({ catalogPath, outputDir, sourceProvider: provider, limits: options.limits });
  return { root, catalogPath, outputDir, manifest };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function verificationInput(result) {
  return { catalogPath: result.catalogPath, bundleDir: result.outputDir };
}

async function snapshotDirectory(root) {
  const results = new Map();
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute, relative);
      } else {
        results.set(relative, await readFile(absolute, "utf8"));
      }
    }
  }
  await visit(root);
  return results;
}

test("rejects hostile and ambiguous source paths", () => {
  for (const hostile of ["../README.md", "/README.md", "C:/README.md", "docs\\README.md", "docs/%2e%2e/secret.md", "docs/%2fsecret.md", "docs\u0000/README.md"]) {
    assert.throws(() => normalizeSourcePath(hostile), OfflineDocsPolicyError, hostile);
  }
  assert.equal(normalizeSourcePath("docs/香港粵語.md"), "docs/香港粵語.md");
});

test("selects only README and docs Markdown while excluding scripts and vendored trees", () => {
  assert.equal(isRepositoryDocumentationPath("README.md"), true);
  assert.equal(isRepositoryDocumentationPath("docs/Guide.md"), true);
  assert.equal(isRepositoryDocumentationPath("docs/香港粵語.md"), true);
  assert.equal(isRepositoryDocumentationPath("scripts/README.md"), false);
  assert.equal(isRepositoryDocumentationPath("docs/vendor/README.md"), false);
  assert.equal(isRepositoryDocumentationPath("docs/run.ps1"), false);
});

test("refuses a provider attempt to import scripts or binary-like files", async (t) => {
  const catalogApp = app();
  const repositories = new Map([
    [catalogApp.id, available(catalogApp.repository, "repository", [{ path: "scripts/README.md", content: "# Do not bundle me\n" }])],
  ]);
  const result = await fixture([catalogApp], fixtureProvider({ repositories }));
  t.after(() => rm(result.root, { recursive: true, force: true }));
  assert.equal(result.manifest.apps[0].sources.repository.status, "unavailable");
  assert.equal(result.manifest.apps[0].sources.repository.reasonCode, "source-path-out-of-scope");
  assert.equal(result.manifest.articles.length, 0);
});

test("records a private repository as unavailable and imports none of its content", async (t) => {
  const catalogApp = app("private-app", "private-app", "Private App");
  const repositories = new Map([[
    catalogApp.id,
    {
      status: "unavailable",
      sourceUrl: sourceUrl(catalogApp.repository, "repository"),
      commitSha: null,
      reasonCode: "private-repository",
      files: [],
    },
  ]]);
  const result = await fixture([catalogApp], fixtureProvider({ repositories }));
  t.after(() => rm(result.root, { recursive: true, force: true }));
  assert.equal(result.manifest.apps[0].status, "unavailable");
  assert.equal(result.manifest.apps[0].sources.repository.reasonCode, "private-repository");
  assert.equal(result.manifest.articles.length, 0);
});

test("fails the transaction on a provider-wide outage instead of publishing a hollow bundle", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "offline-docs-outage-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const catalogPath = path.join(root, "catalog.json");
  const outputDir = path.join(root, "bundle");
  const apps = [app(), app("second-app", "second-app", "Second App")];
  await writeFile(catalogPath, `${JSON.stringify({ schemaVersion: 1, organization: "Ding-Ding-Projects", apps }, null, 2)}\n`, "utf8");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "sentinel.txt"), "preserve me\n", "utf8");
  const outage = {
    async repository(catalogApp) {
      return {
        status: "unavailable",
        sourceUrl: `https://github.com/Ding-Ding-Projects/${catalogApp.repository}`,
        commitSha: null,
        reasonCode: "repository-unavailable",
        files: [],
      };
    },
    async wiki(catalogApp) {
      return empty(catalogApp.repository, "wiki");
    },
  };
  await assert.rejects(
    () => importOfflineDocs({ catalogPath, outputDir, sourceProvider: outage }),
    /Every curated repository was unavailable/u,
  );
  assert.equal(await readFile(path.join(outputDir, "sentinel.txt"), "utf8"), "preserve me\n");
});

test("resume mode revalidates imported sources and retries only transient failures", async (t) => {
  const firstApp = app();
  const secondApp = app("second-app", "second-app", "Second App");
  const repositories = new Map([
    [firstApp.id, available(firstApp.repository, "repository", [{ path: "README.md", content: "# First\n\nPinned content.\n" }])],
    [secondApp.id, {
      status: "unavailable",
      sourceUrl: `https://github.com/Ding-Ding-Projects/${secondApp.repository}`,
      commitSha: null,
      reasonCode: "repository-unavailable",
      files: [],
    }],
  ]);
  const initial = await fixture([firstApp, secondApp], fixtureProvider({ repositories }));
  t.after(() => rm(initial.root, { recursive: true, force: true }));
  assert.equal(initial.manifest.counts.importedApps, 1);

  const manifestPath = path.join(initial.outputDir, "manifest.json");
  const originalManifestText = await readFile(manifestPath, "utf8");
  const tamperedManifest = JSON.parse(originalManifestText);
  tamperedManifest.articles[0].sourceBlobSha = "0".repeat(40);
  await writeFile(manifestPath, `${JSON.stringify(tamperedManifest, null, 2)}\n`, "utf8");
  const tampered = await importOfflineDocs({
    catalogPath: initial.catalogPath,
    outputDir: initial.outputDir,
    sourceProvider: await createBundleResumeProvider({
      bundleDir: initial.outputDir,
      delegate: {
        repository: async () => available(firstApp.repository, "repository", [{ path: "README.md", content: "# Revalidated\n" }]),
        wiki: async () => empty(firstApp.repository, "wiki"),
      },
    }),
  });
  assert.equal(tampered.apps[0].sources.repository.status, "imported");
  assert.notEqual(tampered.articles[0].sourceBlobSha, "0".repeat(40));
  await writeFile(manifestPath, originalManifestText, "utf8");

  let firstRepositoryCalls = 0;
  const delegate = {
    async repository(catalogApp) {
      if (catalogApp.id === firstApp.id) {
        firstRepositoryCalls += 1;
        return available(firstApp.repository, "repository", [{ path: "README.md", content: "# First\n\nRevalidated content.\n" }]);
      }
      return available(secondApp.repository, "repository", [{ path: "README.md", content: "# Second\n\nRecovered content.\n" }]);
    },
    async wiki(catalogApp) {
      return empty(catalogApp.repository, "wiki");
    },
  };
  const resumeProvider = await createBundleResumeProvider({ bundleDir: initial.outputDir, delegate });
  const resumed = await importOfflineDocs({
    catalogPath: initial.catalogPath,
    outputDir: initial.outputDir,
    sourceProvider: resumeProvider,
  });
  assert.equal(firstRepositoryCalls, 1);
  assert.equal(resumed.counts.importedApps, 2);
  assert.equal(resumed.counts.articles, 2);
  assert.deepEqual(await verifyOfflineDocsBundle(verificationInput(initial)), { appCount: 2, articleCount: 2, markdownFileCount: 2 });
  const beforeSecondResume = await snapshotDirectory(initial.outputDir);
  const secondResumeProvider = await createBundleResumeProvider({ bundleDir: initial.outputDir, delegate });
  await importOfflineDocs({
    catalogPath: initial.catalogPath,
    outputDir: initial.outputDir,
    sourceProvider: secondResumeProvider,
  });
  assert.deepEqual(await snapshotDirectory(initial.outputDir), beforeSecondResume);
});

test("rejects source and file URLs outside the curated GitHub owner and repository", async (t) => {
  const catalogApp = app();
  const repositories = new Map([[
    catalogApp.id,
    {
      ...available(catalogApp.repository, "repository", [{ path: "README.md", content: "# Wrong owner\n" }]),
      sourceUrl: `https://github.com/attacker-owner/${catalogApp.repository}`,
    },
  ]]);
  const result = await fixture([catalogApp], fixtureProvider({ repositories }));
  t.after(() => rm(result.root, { recursive: true, force: true }));
  assert.equal(result.manifest.apps[0].sources.repository.status, "unavailable");
  assert.equal(result.manifest.apps[0].sources.repository.reasonCode, "invalid-source-owner");
  assert.equal(result.manifest.articles.length, 0);
});

test("rejects sibling repository-prefix URLs and repository URLs not pinned to the snapshot SHA", async (t) => {
  const catalogApp = app();
  const sibling = available(catalogApp.repository, "repository", [{ path: "README.md", content: "# Prefix confusion\n" }]);
  sibling.sourceUrl = `https://github.com/Ding-Ding-Projects/${catalogApp.repository}-evil/tree/${REPOSITORY_SHA}`;
  sibling.files[0].sourceUrl = `https://github.com/Ding-Ding-Projects/${catalogApp.repository}-evil/blob/${REPOSITORY_SHA}/README.md`;
  const first = await fixture([catalogApp], fixtureProvider({ repositories: new Map([[catalogApp.id, sibling]]) }));
  t.after(() => rm(first.root, { recursive: true, force: true }));
  assert.equal(first.manifest.apps[0].sources.repository.reasonCode, "invalid-source-owner");

  const unpinned = available(catalogApp.repository, "repository", [{ path: "README.md", content: "# Wrong SHA\n" }]);
  unpinned.files[0].sourceUrl = `https://github.com/Ding-Ding-Projects/${catalogApp.repository}/blob/${"c".repeat(40)}/README.md`;
  const second = await fixture([catalogApp], fixtureProvider({ repositories: new Map([[catalogApp.id, unpinned]]) }));
  t.after(() => rm(second.root, { recursive: true, force: true }));
  assert.equal(second.manifest.apps[0].sources.repository.reasonCode, "unpinned-source-url");
});

test("rejects source URLs containing embedded credentials, query data, or fragments", async (t) => {
  const catalogApp = app();
  const credentialed = available(catalogApp.repository, "repository", [{ path: "README.md", content: "# Secret URL\n" }]);
  credentialed.sourceUrl = `https://secret-user:secret-pass@github.com/Ding-Ding-Projects/${catalogApp.repository}/tree/${REPOSITORY_SHA}`;
  const result = await fixture([catalogApp], fixtureProvider({ repositories: new Map([[catalogApp.id, credentialed]]) }));
  t.after(() => rm(result.root, { recursive: true, force: true }));
  assert.equal(result.manifest.apps[0].sources.repository.reasonCode, "credential-bearing-source-url");
  assert.equal(result.manifest.articles.length, 0);
  const manifestText = await readFile(path.join(result.outputDir, "manifest.json"), "utf8");
  assert.doesNotMatch(manifestText, /secret-user|secret-pass/u);
});

test("marks an oversized documentation source unavailable without writing partial content", async (t) => {
  const catalogApp = app();
  const repositories = new Map([
    [catalogApp.id, available(catalogApp.repository, "repository", [{ path: "README.md", content: "# Too large\n1234567890" }])],
  ]);
  const result = await fixture([catalogApp], fixtureProvider({ repositories }), {
    limits: { maxBytesPerFile: 10, maxBytesPerSource: 20 },
  });
  t.after(() => rm(result.root, { recursive: true, force: true }));
  assert.equal(result.manifest.apps[0].status, "unavailable");
  assert.equal(result.manifest.apps[0].sources.repository.reasonCode, "source-file-size-exceeded");
  assert.equal(result.manifest.articles.length, 0);
  assert.deepEqual(await verifyOfflineDocsBundle(verificationInput(result)), { appCount: 1, articleCount: 0, markdownFileCount: 0 });
});

test("rewrites internal links, omits assets, redacts secrets, and records a missing wiki", async (t) => {
  const catalogApp = app();
  const repositories = new Map([
    [catalogApp.id, available(catalogApp.repository, "repository", [
      {
        path: "README.md",
        content: "# Hello\n\nRead the [Guide](docs/Guide.md#Start) or [Reference guide][guide].\n\n[guide]: docs/Guide.md\n\n![Logo](https://example.com/logo.png)\n\n![shortcut]\n[shortcut]: https://tracker.invalid/pixel.png\n\n<style>@import url(https://example.com/theme.css);</style>\n<input type=\"image\" src=\"https://example.com/button.png\">\n<meta http-equiv=\"refresh\" content=\"0;url=https://example.com\">\n<body background=\"https://example.com/bg.png\">Raw HTML body</body>\n\n[Website](https://example.com)\n\nLiteral `<script src>` stays documentation, not executable HTML.\n\nTokens ghp_123456789012345678901234567890, glpat-12345678901234567890, and npm_abcdefghijklmnopqrstuvwxyz0123456789.\n",
      },
      { path: "docs/Guide.md", content: "# Guide\n\nWelcome.\n" },
    ])],
  ]);
  const result = await fixture([catalogApp], fixtureProvider({ repositories }));
  t.after(() => rm(result.root, { recursive: true, force: true }));
  const readme = result.manifest.articles.find((article) => article.sourcePath === "README.md");
  const guide = result.manifest.articles.find((article) => article.sourcePath === "docs/Guide.md");
  const content = await readFile(path.join(result.outputDir, ...readme.contentPath.split("/")), "utf8");
  assert.match(content, new RegExp(`app-doc://article/${guide.id}#Start`, "u"));
  assert.equal(readme.internalLinks.includes(guide.id), true);
  assert.equal(readme.omittedAssetCount, 3);
  assert.equal(readme.redactionCount, 3);
  assert.doesNotMatch(content, /!\[/u);
  assert.doesNotMatch(content, /ghp_/u);
  assert.doesNotMatch(content, /glpat-/u);
  assert.doesNotMatch(content, /npm_/u);
  assert.match(content, new RegExp(`^\\[guide\\]: app-doc://article/${guide.id}$`, "mu"));
  assert.doesNotMatch(content, /@import|<style/iu);
  assert.doesNotMatch(content, /<(?:input|meta|body)\b/iu);
  assert.match(content, /\[Website\]\(https:\/\/example\.com\)/u);
  assert.match(content, /`<script src>`/u);
  assert.equal(result.manifest.apps[0].sources.wiki.status, "empty");
  assert.equal(result.manifest.apps[0].sources.wiki.reasonCode, "wiki-not-found");
});

test("rewrites GitHub wiki links to stable in-app article identifiers", async (t) => {
  const catalogApp = app();
  const repositories = new Map([
    [catalogApp.id, available(catalogApp.repository, "repository", [
      {
        path: "README.md",
        content: `# Repository\n\nRead the [wiki](https://github.com/Ding-Ding-Projects/${catalogApp.repository}/wiki/Home).\n`,
      },
    ])],
  ]);
  const wikis = new Map([
    [catalogApp.id, available(catalogApp.repository, "wiki", [
      {
        path: "Home.md",
        content: `# 首頁\n\nSee [[更多資料|More Info]] or the [repository README](https://github.com/Ding-Ding-Projects/${catalogApp.repository}/blob/${REPOSITORY_SHA}/README.md).\n`,
      },
      { path: "More-Info.md", content: "# 更多資料\n\n好嘢。\n" },
    ])],
  ]);
  const result = await fixture([catalogApp], fixtureProvider({ repositories, wikis }));
  t.after(() => rm(result.root, { recursive: true, force: true }));
  const home = result.manifest.articles.find((article) => article.sourcePath === "Home.md");
  const more = result.manifest.articles.find((article) => article.sourcePath === "More-Info.md");
  const readme = result.manifest.articles.find((article) => article.sourcePath === "README.md");
  const homeContent = await readFile(path.join(result.outputDir, ...home.contentPath.split("/")), "utf8");
  const readmeContent = await readFile(path.join(result.outputDir, ...readme.contentPath.split("/")), "utf8");
  assert.equal(homeContent.includes(`[更多資料](app-doc://article/${more.id})`), true);
  assert.equal(homeContent.includes(`[repository README](app-doc://article/${readme.id})`), true);
  assert.equal(readmeContent.includes(`[wiki](app-doc://article/${home.id})`), true);
  assert.deepEqual(home.internalLinks, [more.id, readme.id].sort());
  assert.deepEqual(readme.internalLinks, [home.id]);
});

test("preserves Unicode titles and searchable body text", async (t) => {
  const catalogApp = app("unicode-app", "unicode-app", "Unicode App");
  const repositories = new Map([
    [catalogApp.id, available(catalogApp.repository, "repository", [{ path: "docs/香港粵語.md", content: "# 離線文件 📚\n\n蝦餃同燒賣都搵得到。\n" }])],
  ]);
  const result = await fixture([catalogApp], fixtureProvider({ repositories }));
  t.after(() => rm(result.root, { recursive: true, force: true }));
  assert.equal(result.manifest.articles[0].title, "離線文件 📚");
  const search = await readJson(path.join(result.outputDir, "search-index.json"));
  assert.match(search.documents[0].text, /蝦餃同燒賣都搵得到/u);
});

test("records a public empty repository explicitly", async (t) => {
  const result = await fixture([app("empty-app", "empty-app", "Empty App")], fixtureProvider());
  t.after(() => rm(result.root, { recursive: true, force: true }));
  assert.equal(result.manifest.apps[0].status, "empty");
  assert.equal(result.manifest.apps[0].articleCount, 0);
  assert.equal(result.manifest.apps[0].sources.repository.reasonCode, "empty-repository");
  assert.equal(result.manifest.apps[0].sources.wiki.reasonCode, "wiki-not-found");
});

test("produces byte-for-byte deterministic manifests, content, and search data", async (t) => {
  const catalogApp = app();
  const repositories = new Map([
    [catalogApp.id, available(catalogApp.repository, "repository", [
      { path: "README.md", content: "# Deterministic\r\n\r\nSame input.\r\n" },
      { path: "docs/Zebra.md", content: "# Zebra\n" },
    ])],
  ]);
  const provider = fixtureProvider({ repositories });
  const first = await fixture([catalogApp], provider);
  const second = await fixture([catalogApp], provider);
  t.after(() => Promise.all([rm(first.root, { recursive: true, force: true }), rm(second.root, { recursive: true, force: true })]));
  assert.deepEqual(await snapshotDirectory(first.outputDir), await snapshotDirectory(second.outputDir));
});

test("fails completeness verification when an indexed Markdown file is absent", async (t) => {
  const catalogApp = app();
  const repositories = new Map([
    [catalogApp.id, available(catalogApp.repository, "repository", [{ path: "README.md", content: "# Complete\n" }])],
  ]);
  const result = await fixture([catalogApp], fixtureProvider({ repositories }));
  t.after(() => rm(result.root, { recursive: true, force: true }));
  await unlink(path.join(result.outputDir, ...result.manifest.articles[0].contentPath.split("/")));
  await assert.rejects(() => verifyOfflineDocsBundle(verificationInput(result)), /Bundled Markdown is missing/u);
});

test("fails completeness verification when a curated app record is absent", async (t) => {
  const result = await fixture([app(), app("second-app", "second-app", "Second App")], fixtureProvider());
  t.after(() => rm(result.root, { recursive: true, force: true }));
  const manifestPath = path.join(result.outputDir, "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.apps.pop();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await assert.rejects(() => verifyOfflineDocsBundle(verificationInput(result)), /Every curated app must have exactly one ordered manifest record/u);
});

test("fails verification when manifest source URLs are changed to another owner or SHA", async (t) => {
  const catalogApp = app();
  const repositories = new Map([
    [catalogApp.id, available(catalogApp.repository, "repository", [{ path: "README.md", content: "# Verified URL\n" }])],
  ]);
  const first = await fixture([catalogApp], fixtureProvider({ repositories }));
  t.after(() => rm(first.root, { recursive: true, force: true }));
  const firstManifestPath = path.join(first.outputDir, "manifest.json");
  const firstManifest = await readJson(firstManifestPath);
  firstManifest.apps[0].sources.repository.sourceUrl = `https://github.com/attacker/private-repository/tree/${REPOSITORY_SHA}`;
  await writeFile(firstManifestPath, `${JSON.stringify(firstManifest, null, 2)}\n`, "utf8");
  await assert.rejects(() => verifyOfflineDocsBundle(verificationInput(first)), /does not belong to the curated repository/u);

  const second = await fixture([catalogApp], fixtureProvider({ repositories }));
  t.after(() => rm(second.root, { recursive: true, force: true }));
  const secondManifestPath = path.join(second.outputDir, "manifest.json");
  const secondManifest = await readJson(secondManifestPath);
  secondManifest.articles[0].sourceUrl = `https://github.com/Ding-Ding-Projects/${catalogApp.repository}/blob/${"c".repeat(40)}/README.md`;
  await writeFile(secondManifestPath, `${JSON.stringify(secondManifest, null, 2)}\n`, "utf8");
  await assert.rejects(() => verifyOfflineDocsBundle(verificationInput(second)), /Article URL is not pinned/u);
});

test("keeps wiki ingestion blobless, checkout-free, and Markdown-selective", async () => {
  const providerSource = await readFile(new URL("../src/gh-provider.mjs", import.meta.url), "utf8");
  assert.match(providerSource, /"--filter=blob:none"/u);
  assert.match(providerSource, /"--no-checkout"/u);
  assert.match(providerSource, /"ls-tree", "-r", "-z", "HEAD"/u);
  assert.match(providerSource, /"cat-file", "blob", candidate\.sha/u);
  assert.doesNotMatch(providerSource, /readFile\(candidate\.absolute/u);
});

test("fails completeness verification when any unexpected Markdown or executable appears in the bundle", async (t) => {
  const result = await fixture([app()], fixtureProvider());
  t.after(() => rm(result.root, { recursive: true, force: true }));
  await mkdir(result.outputDir, { recursive: true });
  await writeFile(path.join(result.outputDir, "extra.md"), "# Surprise\n", "utf8");
  await writeFile(path.join(result.outputDir, "payload.ps1"), "Write-Host nope\n", "utf8");
  await assert.rejects(() => verifyOfflineDocsBundle(verificationInput(result)), /Bundle contains a missing or unexpected file/u);
});
