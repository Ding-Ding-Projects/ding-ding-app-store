import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  assertLifecycleReceipt,
  LIFECYCLE_PRODUCT_IDS,
  LIFECYCLE_PROOF_SCHEMA,
} from './lifecycle-proof-matrix.mjs';

const inputDir = path.resolve(process.argv[process.argv.indexOf('--input-dir') + 1] ?? 'lifecycle-proof-receipts');
const output = path.resolve(process.argv[process.argv.indexOf('--output') + 1] ?? 'lifecycle-proof.v2.json');

function fail(message) {
  process.stderr.write(`[lifecycle-proof-aggregate] ${message}\n`);
  process.exitCode = 2;
}

try {
  const names = (await readdir(inputDir)).filter((name) => name.endsWith('.json')).sort();
  const receipts = [];
  for (const name of names) {
    const parsed = JSON.parse(await readFile(path.join(inputDir, name), 'utf8'));
    if (parsed.schemaVersion !== LIFECYCLE_PROOF_SCHEMA || parsed.matrixVersion !== '13-products-v1' || parsed.productCount !== 1 || parsed.expectedProductCount !== 13 || !Array.isArray(parsed.receipts) || parsed.receipts.length !== 1) {
      throw new Error(`Receipt ${name} must be a one-product lifecycle-proof.v2 receipt with matrixVersion 13-products-v1.`);
    }
    const receipt = assertLifecycleReceipt(parsed.receipts[0]);
    if (parsed.receipts[0].product.appId !== parsed.product?.appId) throw new Error(`Receipt ${name} has inconsistent aggregate and receipt product identifiers.`);
    receipts.push(receipt);
  }
  const byId = new Map(receipts.map((receipt) => [receipt.product?.appId, receipt]));
  const missing = LIFECYCLE_PRODUCT_IDS.filter((appId) => !byId.has(appId));
  const duplicates = receipts.map((receipt) => receipt.product?.appId).filter((appId, index, all) => appId && all.indexOf(appId) !== index);
  if (missing.length || duplicates.length || receipts.length !== 13) {
    throw new Error(`Expected exactly 13 unique matrix receipts; found ${receipts.length}. Missing=${missing.join(',') || 'none'} Duplicates=${[...new Set(duplicates)].join(',') || 'none'}.`);
  }
  const ordered = LIFECYCLE_PRODUCT_IDS.map((appId) => byId.get(appId));
  const aggregate = {
    schemaVersion: LIFECYCLE_PROOF_SCHEMA,
    matrixVersion: '13-products-v1',
    productCount: ordered.length,
    expectedProductCount: 13,
    receipts: ordered,
    verdict: ordered.every((receipt) => receipt.verdict === true),
    dependencyPoints: [...new Set(ordered.flatMap((receipt) => receipt.stages.filter((stage) => stage.status === 'blocked').map((stage) => `${receipt.product.appId}:${stage.name}`)))],
  };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(aggregate, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`[lifecycle-proof-aggregate] wrote ${aggregate.productCount} receipts; verdict=${aggregate.verdict}\n`);
  process.exitCode = aggregate.verdict ? 0 : 1;
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
