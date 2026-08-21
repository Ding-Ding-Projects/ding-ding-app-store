import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const textExtensions = new Set(['.c', '.cc', '.cpp', '.css', '.h', '.hpp', '.html', '.js', '.json', '.jsonl', '.md', '.mjs', '.ps1', '.sh', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml']);
const agentIdentity = /(anthropic|claude|codex|openai|automation|\[bot\]|agent)/i;
const execFileAsync = promisify(execFile);
const BLAME_CONCURRENCY = 8;

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...options });
}

async function gitAsync(args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

function trackedFiles() {
  return git(['ls-files', '-z']).split('\0').filter(Boolean).sort();
}

function categoryOf(file) {
  const normalized = file.replaceAll('\\', '/');
  const base = path.posix.basename(normalized);
  const extension = path.posix.extname(normalized).toLowerCase();
  if (/^(node_modules|dist|release|coverage|vendor|third_party)\//.test(normalized)) return 'Excluded vendor/build';
  if (/^(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(base)) return 'Excluded lockfiles';
  if (/^(tests|packages\/[^/]+\/test)\//.test(normalized) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return 'Tests';
  if (/^(src|packages\/[^/]+\/src)\//.test(normalized) && /\.[cm]?[jt]sx?$/.test(normalized)) return 'Source';
  if (extension === '.css' || extension === '.html') return 'Styles and markup';
  if (extension === '.md' || /^(docs|wiki)\//.test(normalized)) return 'Documentation';
  if (/^(\.github|scripts)\//.test(normalized) || ['.json', '.yml', '.yaml', '.toml', '.ps1', '.sh', '.mjs'].includes(extension)) return 'Configuration and tooling';
  if (/^(data|generated)\//.test(normalized)) return 'Data and generated records';
  return 'Other project files';
}

function lineStats(file) {
  let buffer;
  try {
    buffer = readFileSync(path.join(root, file));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  if (!textExtensions.has(path.extname(file).toLowerCase()) || buffer.includes(0)) return null;
  const text = buffer.toString('utf8');
  if (!text) return { total: 0, nonblank: 0 };
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.at(-1) === '') lines.pop();
  return { total: lines.length, nonblank: lines.filter((line) => line.trim().length > 0).length };
}

function agentCommitMap() {
  const result = new Map();
  const records = git(['log', 'HEAD', '--format=%H%x1f%an%x1f%ae%x1f%B%x1e']).split('\x1e');
  for (const rawRecord of records) {
    const record = rawRecord.replace(/^\r?\n/, '').trimEnd();
    if (!record) continue;
    const [commit, authorName = '', authorEmail = '', ...bodyParts] = record.split('\x1f');
    const metadata = `${authorName}\n${authorEmail}\n${bodyParts.join('\x1f')}`;
    result.set(commit.trim(), agentIdentity.test(metadata) || /co-authored-by:.*(anthropic|claude|codex|openai|agent)/i.test(metadata));
  }
  return result;
}

async function attribution(file, expectedLines, agentCommits) {
  if (expectedLines === 0) return { agent: 0, people: 0, uncommitted: 0 };
  let porcelain;
  try {
    porcelain = await gitAsync(['blame', '--line-porcelain', '--', file]);
  } catch {
    return { agent: 0, people: 0, uncommitted: expectedLines };
  }
  const commits = porcelain.match(/^[0-9a-f]{40} \d+ \d+(?: \d+)?$/gm)?.map((line) => line.slice(0, 40)) ?? [];
  const result = { agent: 0, people: 0, uncommitted: 0 };
  for (const commit of commits) {
    if (/^0+$/.test(commit)) result.uncommitted += 1;
    else if (agentCommits.get(commit) === true) result.agent += 1;
    else result.people += 1;
  }
  const missing = expectedLines - commits.length;
  if (missing > 0) result.uncommitted += missing;
  return result;
}

async function forEachConcurrent(items, concurrency, worker) {
  let cursor = 0;
  const count = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: count }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }));
}

const rows = new Map();
const attributionJobs = [];
for (const file of trackedFiles()) {
  const stats = lineStats(file);
  if (!stats) continue;
  const category = categoryOf(file);
  const row = rows.get(category) ?? { category, files: 0, total: 0, nonblank: 0, agent: 0, people: 0, uncommitted: 0, attributed: !category.startsWith('Excluded ') };
  row.files += 1;
  row.total += stats.total;
  row.nonblank += stats.nonblank;
  if (row.attributed) attributionJobs.push({ file, expectedLines: stats.total, row });
  rows.set(category, row);
}

const agentCommits = agentCommitMap();
await forEachConcurrent(attributionJobs, BLAME_CONCURRENCY, async ({ file, expectedLines, row }) => {
  const ownership = await attribution(file, expectedLines, agentCommits);
  row.agent += ownership.agent;
  row.people += ownership.people;
  row.uncommitted += ownership.uncommitted;
});

const ordered = [...rows.values()].sort((a, b) => a.category.localeCompare(b.category));
const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);
const projectRows = ordered.filter((row) => row.attributed);
const project = {
  files: sum(projectRows, 'files'), total: sum(projectRows, 'total'), nonblank: sum(projectRows, 'nonblank'),
  agent: sum(projectRows, 'agent'), people: sum(projectRows, 'people'), uncommitted: sum(projectRows, 'uncommitted'),
};
const grand = { files: sum(ordered, 'files'), total: sum(ordered, 'total'), nonblank: sum(ordered, 'nonblank') };

if (project.agent + project.people + project.uncommitted !== project.total) {
  throw new Error(`Attribution arithmetic mismatch: ${project.agent} + ${project.people} + ${project.uncommitted} != ${project.total}`);
}

const report = { schemaVersion: 1, rows: ordered, project, grand, exclusions: ['dependency/vendor directories', 'build output', 'lockfiles from the project total'] };
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const lines = [
    '| Category | Files | Total lines | Non-blank | Agent-authored | People-authored | Uncommitted |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...ordered.map((row) => `| ${row.category} | ${row.files} | ${row.total} | ${row.nonblank} | ${row.attributed ? row.agent : 'excluded'} | ${row.attributed ? row.people : 'excluded'} | ${row.attributed ? row.uncommitted : 'excluded'} |`),
    `| **Project total** | **${project.files}** | **${project.total}** | **${project.nonblank}** | **${project.agent}** | **${project.people}** | **${project.uncommitted}** |`,
    `| **Grand total of tracked text** | **${grand.files}** | **${grand.total}** | **${grand.nonblank}** | — | — | — |`,
    '',
    'Project total excludes dependency/vendor trees, build output, and lockfiles. Agent attribution uses surviving `git blame` lines whose commit author or `Co-Authored-By` trailer identifies an agent or automation identity; churn and deleted lines are not counted.',
    '',
    'Reproduce with: `npm run count:lines`',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}
