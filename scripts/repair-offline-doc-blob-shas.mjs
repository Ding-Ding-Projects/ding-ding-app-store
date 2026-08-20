import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const bundleDir = path.resolve(process.argv[2] ?? "data/offline-docs");
const manifestPath = path.join(bundleDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
let repaired = 0;
for (const article of manifest.articles ?? []) {
  if (/^[0-9a-f]{40,64}$/u.test(article.sourceBlobSha ?? "")) continue;
  const content = await readFile(path.join(bundleDir, article.contentPath), "utf8");
  const bytes = Buffer.from(content, "utf8");
  const header = Buffer.from(`blob ${bytes.byteLength}\u0000`, "utf8");
  article.sourceBlobSha = createHash("sha1").update(header).update(bytes).digest("hex");
  repaired += 1;
}
const temporary = `${manifestPath}.tmp`;
await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await rename(temporary, manifestPath);
process.stdout.write(`${JSON.stringify({ repaired, articles: manifest.articles?.length ?? 0 })}\n`);
