import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGitHubSourceProvider } from "./gh-provider.mjs";
import { createBundleResumeProvider } from "./cache-provider.mjs";
import { importOfflineDocs } from "./importer.mjs";
import { verifyOfflineDocsBundle } from "./verify.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const catalogPath = path.resolve(argument("--catalog", path.join(repositoryRoot, "data/catalog.v1.json")));
const outputDir = path.resolve(argument("--output", path.join(repositoryRoot, "data/offline-docs")));
const owner = argument("--owner", "Ding-Ding-Projects");

let sourceProvider = createGitHubSourceProvider({ owner });
if (process.argv.includes("--resume")) {
  await verifyOfflineDocsBundle({ catalogPath, bundleDir: outputDir });
  sourceProvider = await createBundleResumeProvider({ bundleDir: outputDir, delegate: sourceProvider });
}

const manifest = await importOfflineDocs({
  catalogPath,
  outputDir,
  sourceProvider,
});

process.stdout.write(`${JSON.stringify({ outputDir, counts: manifest.counts })}\n`);
