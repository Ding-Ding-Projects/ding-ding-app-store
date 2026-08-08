import path from "node:path";

export const DEFAULT_LIMITS = Object.freeze({
  maxCatalogApps: 500,
  maxTreeEntries: 50_000,
  maxFilesPerSource: 500,
  maxBytesPerFile: 1_000_000,
  maxBytesPerSource: 12_000_000,
  maxOutputBytes: 64_000_000,
  maxPathLength: 500,
  maxCommandDurationMs: 60_000,
  maxSourceDurationMs: 300_000,
});

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const WINDOWS_DRIVE = /^[a-z]:/iu;
const EXCLUDED_SEGMENTS = new Set([
  ".git",
  ".github",
  "node_modules",
  "vendor",
  "third_party",
  "third-party",
  "dist",
  "build",
  "coverage",
  "scripts",
]);

export class OfflineDocsPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OfflineDocsPolicyError";
    this.code = code;
  }
}

function decodedPathForValidation(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new OfflineDocsPolicyError("invalid-path-encoding", `Path has invalid percent encoding: ${value}`);
  }
}

function assertPathShape(value, maxPathLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxPathLength) {
    throw new OfflineDocsPolicyError("invalid-path", "Source path is empty or exceeds the configured bound");
  }

  for (const candidate of [value, decodedPathForValidation(value)]) {
    if (
      CONTROL_CHARACTERS.test(candidate) ||
      candidate.includes("\\") ||
      candidate.startsWith("/") ||
      WINDOWS_DRIVE.test(candidate)
    ) {
      throw new OfflineDocsPolicyError("hostile-path", `Unsafe source path: ${value}`);
    }

    const segments = candidate.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      throw new OfflineDocsPolicyError("hostile-path", `Unsafe source path segment: ${value}`);
    }
  }
}

export function normalizeSourcePath(value, maxPathLength = DEFAULT_LIMITS.maxPathLength) {
  assertPathShape(value, maxPathLength);
  return value.normalize("NFC");
}

export function isMarkdownPath(value) {
  return /\.md$/iu.test(value);
}

function hasExcludedSegment(value) {
  return value
    .toLocaleLowerCase("en-US")
    .split("/")
    .some((segment) => EXCLUDED_SEGMENTS.has(segment));
}

export function isRepositoryDocumentationPath(value) {
  const normalized = normalizeSourcePath(value);
  if (!isMarkdownPath(normalized) || hasExcludedSegment(normalized)) {
    return false;
  }

  const segments = normalized.split("/");
  if (segments.length === 1) {
    return /^readme(?:[._-][^/]*)?\.md$/iu.test(segments[0]);
  }
  return segments[0].toLocaleLowerCase("en-US") === "docs";
}

export function isWikiDocumentationPath(value) {
  const normalized = normalizeSourcePath(value);
  return isMarkdownPath(normalized) && !hasExcludedSegment(normalized);
}

export function assertRelativeBundlePath(value) {
  const normalized = normalizeSourcePath(value);
  if (!normalized.startsWith("articles/") || !normalized.endsWith(".md")) {
    throw new OfflineDocsPolicyError("invalid-bundle-path", `Invalid bundled article path: ${value}`);
  }
  return normalized;
}

export function resolveInside(root, relativePath) {
  const normalized = assertRelativeBundlePath(relativePath);
  const rootPath = path.resolve(root);
  const candidate = path.resolve(rootPath, ...normalized.split("/"));
  const relative = path.relative(rootPath, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new OfflineDocsPolicyError("bundle-path-escape", `Bundled path escapes output directory: ${relativePath}`);
  }
  return candidate;
}

export function mergeLimits(overrides = {}) {
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new OfflineDocsPolicyError("invalid-limit", `${name} must be a positive safe integer`);
    }
  }
  return Object.freeze(limits);
}
