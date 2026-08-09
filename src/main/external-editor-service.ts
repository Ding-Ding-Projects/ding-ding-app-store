import { execFile, spawn } from 'node:child_process';
import { mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { app, dialog } from 'electron';
import { z } from 'zod';
import type {
  ExternalEditorCandidate,
  ExternalEditorEdition,
  ExternalEditorOpenRequest,
  ExternalEditorPreference,
  ExternalEditorResult,
} from '../shared/contracts.js';
import { externalEditorOpenArchiveRequestSchema, externalEditorOpenRequestSchema, externalEditorPreferenceSchema } from '../shared/contracts.js';
import { readJson, writeJsonAtomic } from './json-store.js';
import { extractZipSafe } from './safe-zip.js';

const execFileAsync = promisify(execFile);
const PREFERENCE_VERSION = 1 as const;
const MAX_EXPORT_BYTES = 256_000;
const MAX_ARCHIVE_BASE64_LENGTH = 23_000_000;
const DEFAULT_PREFERENCE: ExternalEditorPreference = { editor: 'vscode', edition: 'stable' };
const internalPreferenceSchema = z.strictObject({
  schemaVersion: z.literal(PREFERENCE_VERSION),
  editor: z.literal('vscode'),
  edition: z.enum(['stable', 'insiders', 'portable', 'unknown']),
  customPath: z.string().max(512).optional(),
});
type InternalPreference = z.infer<typeof internalPreferenceSchema>;

const EDITION_LABEL: Record<ExternalEditorEdition, string> = {
  stable: 'Visual Studio Code',
  insiders: 'Visual Studio Code Insiders',
  portable: 'Visual Studio Code portable',
  unknown: 'Visual Studio Code',
};

function isCodeExecutable(candidate: string): boolean {
  const base = path.basename(candidate).toLowerCase();
  return base === 'code.exe' || base === 'code - insiders.exe';
}

function inferEdition(candidate: string): ExternalEditorEdition {
  const normalized = candidate.toLowerCase();
  if (normalized.includes('insiders')) return 'insiders';
  if (normalized.includes('portable') || normalized.includes(`${path.sep}scoop${path.sep}`)) return 'portable';
  return 'stable';
}

async function existingExecutable(candidate: string): Promise<string | null> {
  try {
    const resolved = await realpath(candidate);
    const details = await stat(resolved);
    return details.isFile() && isCodeExecutable(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

async function commandCandidates(command: string): Promise<string[]> {
  try {
    const result = await execFileAsync(process.platform === 'win32' ? 'where.exe' : 'which', [command], { windowsHide: true, timeout: 2_000, maxBuffer: 16_384 });
    return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function commandExecutableCandidates(found: string, command: string): string[] {
  if (!found.toLowerCase().endsWith('.cmd')) return [found];
  const executable = command.toLowerCase().includes('insiders') ? 'Code - Insiders.exe' : 'Code.exe';
  const directory = path.dirname(found);
  // The official PATH shim lives in <install>\\bin\\code.cmd while the signed
  // executable lives one directory above. Never execute or parse the shim.
  return [path.join(directory, executable), path.join(directory, '..', executable)];
}

function knownPaths(): string[] {
  const env = process.env;
  const local = env.LOCALAPPDATA;
  const programFiles = env.ProgramFiles;
  const programFilesX86 = env['ProgramFiles(x86)'];
  const userProfile = env.USERPROFILE ?? os.homedir();
  const paths = [
    local && path.join(local, 'Programs', 'Microsoft VS Code', 'Code.exe'),
    local && path.join(local, 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    programFiles && path.join(programFiles, 'Microsoft VS Code', 'Code.exe'),
    programFiles && path.join(programFiles, 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    programFilesX86 && path.join(programFilesX86, 'Microsoft VS Code', 'Code.exe'),
    programFilesX86 && path.join(programFilesX86, 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    path.join(userProfile, 'scoop', 'apps', 'vscode', 'current', 'Code.exe'),
    path.join(userProfile, 'scoop', 'apps', 'vscode-insiders', 'current', 'Code - Insiders.exe'),
  ];
  return paths.filter((value): value is string => Boolean(value));
}

function publicCandidate(pathName: string): ExternalEditorCandidate {
  const edition = inferEdition(pathName);
  return { id: 'vscode', label: EDITION_LABEL[edition], available: true, edition };
}

export class ExternalEditorService {
  private readonly preferencePath = path.join(app.getPath('userData'), 'external-editor.v1.json');
  private readonly exportRoot = path.join(app.getPath('userData'), 'exports', 'vscode');

  async detect(): Promise<ExternalEditorCandidate[]> {
    const paths = new Set<string>();
    for (const command of ['code.exe', 'code-insiders.exe', 'code.cmd', 'code-insiders.cmd']) {
      for (const found of await commandCandidates(command)) {
        for (const candidate of commandExecutableCandidates(found, command)) {
          const resolved = await existingExecutable(candidate);
          if (resolved) paths.add(resolved);
        }
      }
    }
    for (const known of knownPaths()) {
      const resolved = await existingExecutable(known);
      if (resolved) paths.add(resolved);
    }
    const stored = await this.loadInternal();
    if (stored.customPath) {
      const resolved = await existingExecutable(stored.customPath);
      if (resolved) paths.add(resolved);
    }
    const byEdition = new Map<ExternalEditorEdition, string>();
    for (const candidate of paths) {
      const edition = stored.customPath && path.resolve(stored.customPath) === path.resolve(candidate) ? 'portable' : inferEdition(candidate);
      if (!byEdition.has(edition)) byEdition.set(edition, candidate);
    }
    return (['stable', 'insiders', 'portable'] as const)
      .filter((edition) => byEdition.has(edition))
      .map((edition) => publicCandidate(byEdition.get(edition)!));
  }

  async preference(): Promise<ExternalEditorPreference> {
    const stored = await this.loadInternal();
    return { editor: stored.editor, edition: stored.edition };
  }

  async setPreference(input: unknown): Promise<ExternalEditorPreference> {
    const preference = externalEditorPreferenceSchema.parse(input);
    const stored = await this.loadInternal();
    const next: InternalPreference = { ...stored, ...preference };
    await writeJsonAtomic(this.preferencePath, next);
    return preference;
  }

  async addValidated(): Promise<ExternalEditorCandidate | null> {
    const result = await dialog.showOpenDialog({
      title: 'Choose Visual Studio Code executable',
      properties: ['openFile'],
      filters: [{ name: 'Visual Studio Code', extensions: ['exe'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const resolved = await existingExecutable(result.filePaths[0]);
    if (!resolved) return null;
    const candidate = publicCandidate(resolved);
    await writeJsonAtomic(this.preferencePath, { schemaVersion: PREFERENCE_VERSION, editor: 'vscode', edition: 'portable', customPath: resolved });
    return { ...candidate, edition: 'portable', label: EDITION_LABEL.portable };
  }

  async openExport(input: unknown): Promise<ExternalEditorResult> {
    const parsed = externalEditorOpenRequestSchema.safeParse(input);
    if (!parsed.success || Buffer.byteLength(parsed.data?.content ?? '', 'utf8') > MAX_EXPORT_BYTES) {
      return { ok: false, reason: 'write-failed', message: 'The export was rejected because its filename, format, or size is not supported.' };
    }
    const stored = await this.loadInternal();
    const candidates = await this.detectPaths();
    const executable = stored.edition === 'portable' && stored.customPath && candidates.has(path.resolve(stored.customPath))
      ? stored.customPath
      : [...candidates].find((candidate) => inferEdition(candidate) === stored.edition) ?? [...candidates][0];
    if (!executable) return { ok: false, reason: 'not-installed', message: 'Visual Studio Code is not installed or no validated executable is available. Exports are still available as downloads.' };
    const safeName = parsed.data.suggestedName;
    const folder = path.join(this.exportRoot, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    const filePath = path.join(folder, safeName);
    try {
      await mkdir(folder, { recursive: true });
      await writeFile(filePath, parsed.data.content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    } catch {
      return { ok: false, reason: 'write-failed', message: 'The export could not be written to the app-owned temporary workspace.' };
    }
    const launched = await new Promise<boolean>((resolve) => {
      const child = spawn(executable, ['--reuse-window', folder], { detached: true, windowsHide: true, shell: false, stdio: 'ignore' });
      let settled = false;
      const finish = (value: boolean) => { if (settled) return; settled = true; resolve(value); };
      child.once('spawn', () => finish(true));
      child.once('error', () => finish(false));
      setTimeout(() => finish(true), 2_000).unref();
      child.unref();
    });
    if (!launched) {
      return { ok: false, reason: 'launch-failed', message: 'Visual Studio Code was found, but Windows did not start it. The export remains in the app-owned workspace and can still be downloaded.' };
    }
    return { ok: true, editor: 'vscode' };
  }

  async openArchive(input: unknown): Promise<ExternalEditorResult> {
    const parsed = externalEditorOpenArchiveRequestSchema.safeParse(input);
    if (!parsed.success || parsed.data.base64.length > MAX_ARCHIVE_BASE64_LENGTH || parsed.data.base64.length % 4 === 1) {
      return { ok: false, reason: 'write-failed', message: 'The archive was rejected because its filename, format, or size is not supported.' };
    }
    const stored = await this.loadInternal();
    const candidates = await this.detectPaths();
    const executable = stored.edition === 'portable' && stored.customPath && candidates.has(path.resolve(stored.customPath))
      ? stored.customPath
      : [...candidates].find((candidate) => inferEdition(candidate) === stored.edition) ?? [...candidates][0];
    if (!executable) return { ok: false, reason: 'not-installed', message: 'Visual Studio Code is not installed or no validated executable is available. The archive is still available as a download.' };
    const folder = path.join(this.exportRoot, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    const archivePath = path.join(folder, parsed.data.suggestedName);
    const workspace = path.join(folder, 'workspace');
    try {
      const archive = Buffer.from(parsed.data.base64, 'base64');
      if (!archive.length || archive.length > 16 * 1024 * 1024) throw new Error('Archive exceeds the supported 16 MiB limit.');
      await mkdir(folder, { recursive: true });
      await writeFile(archivePath, archive, { mode: 0o600, flag: 'wx' });
      await extractZipSafe(archivePath, workspace, undefined, {
        maxEntries: 4,
        maxBytes: 32 * 1024 * 1024,
        allowedNames: new Set(['README.txt', 'history.json', 'history.jsonl', 'manifest.json']),
        requiredNames: new Set(['README.txt', 'history.json', 'history.jsonl', 'manifest.json']),
      });
    } catch {
      await rm(folder, { recursive: true, force: true }).catch(() => undefined);
      return { ok: false, reason: 'write-failed', message: 'The ZIP archive could not be validated and extracted into the app-owned workspace.' };
    }
    const launched = await new Promise<boolean>((resolve) => {
      const child = spawn(executable, ['--reuse-window', workspace], { detached: true, windowsHide: true, shell: false, stdio: 'ignore' });
      let settled = false;
      const finish = (value: boolean) => { if (settled) return; settled = true; resolve(value); };
      child.once('spawn', () => finish(true));
      child.once('error', () => finish(false));
      setTimeout(() => finish(true), 2_000).unref();
      child.unref();
    });
    if (!launched) return { ok: false, reason: 'launch-failed', message: 'Visual Studio Code was found, but Windows did not start it. The extracted archive remains in the app-owned workspace.' };
    return { ok: true, editor: 'vscode' };
  }

  private async detectPaths(): Promise<Set<string>> {
    const result = new Set<string>();
    for (const command of ['code.exe', 'code-insiders.exe', 'code.cmd', 'code-insiders.cmd']) {
      for (const found of await commandCandidates(command)) {
        for (const candidate of commandExecutableCandidates(found, command)) {
          const resolved = await existingExecutable(candidate);
          if (resolved) result.add(path.resolve(resolved));
        }
      }
    }
    for (const known of knownPaths()) {
      const resolved = await existingExecutable(known);
      if (resolved) result.add(path.resolve(resolved));
    }
    const stored = await this.loadInternal();
    if (stored.customPath) {
      const resolved = await existingExecutable(stored.customPath);
      if (resolved) result.add(path.resolve(resolved));
    }
    return result;
  }

  private async loadInternal(): Promise<InternalPreference> {
    const raw = await readJson<unknown>(this.preferencePath, { schemaVersion: PREFERENCE_VERSION, ...DEFAULT_PREFERENCE });
    const parsed = internalPreferenceSchema.safeParse(raw);
    return parsed.success ? parsed.data : { schemaVersion: PREFERENCE_VERSION, ...DEFAULT_PREFERENCE };
  }
}
