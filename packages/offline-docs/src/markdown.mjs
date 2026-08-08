import { createHash } from "node:crypto";
import path from "node:path";

const PRIVATE_KEY_BLOCK = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/giu;
const HIGH_CONFIDENCE_TOKENS = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/gu,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/gu,
  /\bnpm_[A-Za-z0-9]{20,}\b/gu,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/gu,
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/gu,
  /\bAKIA[0-9A-Z]{16}\b/gu,
  /\b(?:xox[baprs]-[A-Za-z0-9-]{20,})\b/gu,
];

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function articleId(appId, sourceKind, sourcePath) {
  return `${appId}.${sourceKind}.${hash(sourcePath).slice(0, 16)}`;
}

export function articleOutputPath(appId, sourceKind, sourcePath) {
  const stem = sourcePath
    .replace(/\.md$/iu, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72) || "article";
  return `articles/${appId}/${sourceKind}/${stem}-${hash(sourcePath).slice(0, 12)}.md`;
}

function titleFromPath(sourcePath) {
  return path.posix
    .basename(sourcePath, path.posix.extname(sourcePath))
    .replace(/[-_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function extractTitle(markdown, sourcePath) {
  const heading = markdown.match(/^#\s+(.+)$/mu)?.[1]
    ?.replace(/\[(.*?)\]\([^)]*\)/gu, "$1")
    .replace(/[*_`~]/gu, "")
    .trim();
  const title = heading || titleFromPath(sourcePath) || "Untitled article";
  return title.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").slice(0, 300);
}

function redactSecrets(markdown) {
  let redactionCount = 0;
  let output = markdown.replace(PRIVATE_KEY_BLOCK, () => {
    redactionCount += 1;
    return "[REDACTED PRIVATE KEY]";
  });
  for (const pattern of HIGH_CONFIDENCE_TOKENS) {
    output = output.replace(pattern, () => {
      redactionCount += 1;
      return "[REDACTED TOKEN]";
    });
  }
  return { output, redactionCount };
}

function protectMarkdownCode(markdown) {
  const slots = [];
  const hold = (value) => {
    const token = `\uE000OFFLINE_CODE_${slots.length}\uE001`;
    slots.push(value);
    return token;
  };
  let output = markdown.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gmu, hold);
  output = output.replace(/(`+)[^`\n]*?\1/gu, hold);
  return {
    output,
    restore(value) {
      return value.replace(/\uE000OFFLINE_CODE_(\d+)\uE001/gu, (_match, index) => slots[Number(index)]);
    },
  };
}

export function markdownForSecurityInspection(markdown) {
  const protectedCode = protectMarkdownCode(markdown);
  return protectedCode.output;
}

function stripLoadableAssets(markdown) {
  let omittedAssetCount = 0;
  const protectedCode = protectMarkdownCode(markdown);
  let output = protectedCode.output
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/giu, () => {
      omittedAssetCount += 1;
      return "\n*External stylesheet omitted from the offline bundle.*\n";
    })
    .replace(/<(?:iframe|object|embed|video|audio|picture)\b[^>]*>[\s\S]*?<\/(?:iframe|object|video|audio|picture)\s*>/giu, () => {
      omittedAssetCount += 1;
      return "\n*External media omitted from the offline bundle.*\n";
    })
    .replace(/<(?:img|image|source|track|link|use)\b[^>]*\/?\s*>/giu, () => {
      omittedAssetCount += 1;
      return "*Image or external asset omitted from the offline bundle.*";
    })
    .replace(/!\[([^\]\n]*)\]\([^\n)]*\)/gu, (_match, alt) => {
      omittedAssetCount += 1;
      return `*Image omitted from the offline bundle: ${alt.trim() || "unnamed image"}.*`;
    })
    .replace(/!\[([^\]\n]*)\]\[[^\]\n]*\]/gu, (_match, alt) => {
      omittedAssetCount += 1;
      return `*Image omitted from the offline bundle: ${alt.trim() || "unnamed image"}.*`;
    })
    .replace(/!\[([^\]\n]+)\](?![ \t]*[[(])/gu, (_match, alt) => {
      omittedAssetCount += 1;
      return `*Image omitted from the offline bundle: ${alt.trim()}.*`;
    })
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*|\/?)>/gu, "");
  return { output: protectedCode.restore(output), omittedAssetCount };
}

function splitDestination(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end > 0 ? { destination: trimmed.slice(1, end), suffix: trimmed.slice(end + 1) } : null;
  }
  const match = trimmed.match(/^(\S+)([\s\S]*)$/u);
  return match ? { destination: match[1], suffix: match[2] } : null;
}

function resolveRelativePath(currentPath, destination, sourceKind) {
  let decoded;
  try {
    decoded = decodeURIComponent(destination);
  } catch {
    return { blocked: true };
  }
  if (decoded.includes("\\") || decoded.startsWith("/") || /^[a-z]:/iu.test(decoded)) {
    return { blocked: true };
  }
  const joined = path.posix.join(path.posix.dirname(currentPath), decoded);
  const normalized = path.posix.normalize(joined);
  if (normalized === ".." || normalized.startsWith("../")) {
    return { blocked: true };
  }
  if (sourceKind === "wiki" && !/\.md$/iu.test(normalized)) {
    return { path: `${normalized.replace(/\s+/gu, "-")}.md` };
  }
  return { path: normalized };
}

function internalGitHubTarget(destination, owner, repository) {
  let url;
  try {
    url = new URL(destination);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname.toLocaleLowerCase("en-US") !== "github.com") {
    return null;
  }
  const pieces = url.pathname.split("/").filter(Boolean);
  if (
    pieces.length < 3 ||
    pieces[0].toLocaleLowerCase("en-US") !== owner.toLocaleLowerCase("en-US") ||
    pieces[1].toLocaleLowerCase("en-US") !== repository.toLocaleLowerCase("en-US")
  ) {
    return null;
  }
  if (pieces[2] === "blob" && pieces.length >= 5) {
    return {
      sourceKind: "repository",
      candidates: Array.from({ length: pieces.length - 4 }, (_unused, offset) =>
        decodeURIComponent(pieces.slice(4 + offset).join("/"))),
    };
  }
  if (pieces[2] === "wiki" && pieces.length >= 4) {
    const wikiPath = decodeURIComponent(pieces.slice(3).join("/"));
    return { sourceKind: "wiki", candidates: [`${wikiPath.replace(/\s+/gu, "-")}.md`] };
  }
  return null;
}

function lookupArticle(pathToId, candidate) {
  return pathToId.get(candidate) ?? pathToId.get(candidate.toLocaleLowerCase("en-US")) ?? null;
}

function lookupAcrossSources(pathMaps, sourceKind, candidates) {
  const map = pathMaps[sourceKind];
  if (!map) {
    return null;
  }
  for (const candidate of candidates) {
    const target = lookupArticle(map, candidate);
    if (target) {
      return target;
    }
  }
  return null;
}

function rewriteLinkDestination(destination, context) {
  if (destination.startsWith("#")) {
    return { destination, internalId: null, blocked: false };
  }
  if (destination.startsWith("app-doc://article/")) {
    const encodedId = destination.slice("app-doc://article/".length).split(/[?#]/u, 1)[0];
    try {
      return { destination, internalId: decodeURIComponent(encodedId), blocked: false };
    } catch {
      return { destination: null, internalId: null, blocked: true };
    }
  }
  const scheme = destination.match(/^([a-z][a-z0-9+.-]*):/iu)?.[1]?.toLocaleLowerCase("en-US");
  if (scheme && scheme !== "http" && scheme !== "https" && scheme !== "mailto") {
    return { destination: null, internalId: null, blocked: true };
  }
  if (scheme === "http" || scheme === "https") {
    try {
      const external = new URL(destination);
      const sensitiveQuery = [...external.searchParams.keys()].some((key) =>
        /^(?:access[_-]?token|api[_-]?key|auth|credential|key|password|secret|token)$/iu.test(key));
      if (external.username || external.password || sensitiveQuery) {
        return { destination: null, internalId: null, blocked: true };
      }
    } catch {
      return { destination: null, internalId: null, blocked: true };
    }
  }

  const [withoutFragment, fragment = ""] = destination.split("#", 2);
  const [withoutQuery] = withoutFragment.split("?", 1);
  const absoluteInternal = internalGitHubTarget(withoutQuery, context.owner, context.repository);
  const resolved = absoluteInternal
    ? absoluteInternal
    : scheme
      ? null
      : { ...resolveRelativePath(context.currentPath, withoutQuery, context.sourceKind), sourceKind: context.sourceKind };

  if (!resolved) {
    return { destination, internalId: null, blocked: false };
  }
  if (resolved.blocked) {
    return { destination: null, internalId: null, blocked: true };
  }

  const target = lookupAcrossSources(
    context.pathMaps,
    resolved.sourceKind,
    resolved.candidates ?? [resolved.path],
  );
  if (target) {
    const suffix = fragment ? `#${encodeURIComponent(fragment)}` : "";
    return { destination: `app-doc://article/${encodeURIComponent(target)}${suffix}`, internalId: target, blocked: false };
  }

  return { destination: null, internalId: null, blocked: true };
}

function rewriteWikiLinks(markdown, context, internalLinks) {
  if (context.sourceKind !== "wiki") {
    return markdown;
  }
  return markdown.replace(/\[\[([^\]\n]+)\]\]/gu, (_match, raw) => {
    const pieces = raw.split("|");
    const label = (pieces.length > 1 ? pieces[0] : pieces[0]).trim();
    const targetName = (pieces.length > 1 ? pieces.slice(1).join("|") : pieces[0]).trim();
    const candidate = `${targetName.replace(/\s+/gu, "-")}.md`;
    const target = lookupArticle(context.pathMaps.wiki, candidate);
    if (!target) {
      return label;
    }
    internalLinks.add(target);
    return `[${label}](app-doc://article/${encodeURIComponent(target)})`;
  });
}

export function sanitizeAndRewriteMarkdown(markdown, context) {
  const normalized = markdown.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  if (normalized.includes("\u0000")) {
    throw new Error("Markdown contains a NUL byte");
  }
  const secrets = redactSecrets(normalized);
  const assets = stripLoadableAssets(secrets.output);
  const internalLinks = new Set();
  let blockedLinkCount = 0;
  const protectedCode = protectMarkdownCode(assets.output);
  let output = rewriteWikiLinks(protectedCode.output, context, internalLinks);

  output = output.replace(/(?<!!)\[([^\]\n]+)\]\(([^\n)]*)\)/gu, (_match, label, rawDestination) => {
    const parsed = splitDestination(rawDestination);
    if (!parsed) {
      blockedLinkCount += 1;
      return label;
    }
    const rewritten = rewriteLinkDestination(parsed.destination, context);
    if (rewritten.blocked || !rewritten.destination) {
      blockedLinkCount += 1;
      return label;
    }
    if (rewritten.internalId) {
      internalLinks.add(rewritten.internalId);
    }
    return `[${label}](${rewritten.destination}${parsed.suffix})`;
  });

  output = output.replace(/^ {0,3}\[([^\]\n]+)\]:\s*(.+)$/gmu, (_match, reference, rawDestination) => {
    const parsed = splitDestination(rawDestination);
    if (!parsed) {
      blockedLinkCount += 1;
      return "";
    }
    const rewritten = rewriteLinkDestination(parsed.destination, context);
    if (rewritten.blocked || !rewritten.destination) {
      blockedLinkCount += 1;
      return "";
    }
    if (rewritten.internalId) {
      internalLinks.add(rewritten.internalId);
    }
    return `[${reference}]: ${rewritten.destination}${parsed.suffix}`;
  });

  output = `${protectedCode.restore(output).trimEnd()}\n`;
  return {
    content: output,
    redactionCount: secrets.redactionCount,
    omittedAssetCount: assets.omittedAssetCount,
    blockedLinkCount,
    internalLinks: [...internalLinks].sort(),
  };
}

export function buildSearchText(title, markdown) {
  return `${title}\n${markdown}`
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`([^`]*)`/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[#>*_~|]/gu, " ")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

export function sha256(value) {
  return hash(value);
}
