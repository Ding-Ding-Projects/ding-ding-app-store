import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyOfflineDocsBundle } from "./verify.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const catalogPath = path.resolve(argument("--catalog", path.join(repositoryRoot, "data/catalog.v1.json")));
const bundleDir = path.resolve(argument("--bundle", path.join(repositoryRoot, "data/offline-docs")));
const result = await verifyOfflineDocsBundle({ catalogPath, bundleDir });
process.stdout.write(`${JSON.stringify(result)}\n`);
