export type ColorSpace = 'named' | 'hex' | 'rgb' | 'hsl' | 'hsv' | 'hsb' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'cmyk';

export interface ColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ColorTranslation {
  space: ColorSpace;
  text: string;
  value: ColorValue;
  clipped: boolean;
  gamut: 'srgb' | 'display-p3' | 'unknown';
}

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080', grey: '#808080',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a', transparent: '#00000000',
  rebeccapurple: '#663399', tomato: '#ff6347', gold: '#ffd700', indigo: '#4b0082', teal: '#008080',
};

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const round = (n: number, places = 4) => Number(n.toFixed(places));
const clean = (text: string) => text.trim().toLowerCase();

export function parseHex(text: string): ColorValue | null {
  const value = clean(text);
  const match = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!match) return null;
  const raw = match[1];
  return { r: Number.parseInt(raw.slice(0, 2), 16) / 255, g: Number.parseInt(raw.slice(2, 4), 16) / 255, b: Number.parseInt(raw.slice(4, 6), 16) / 255, a: raw.length === 8 ? Number.parseInt(raw.slice(6), 16) / 255 : 1 };
}

export function toHex(value: ColorValue): string {
  const byte = (n: number) => Math.round(clamp(n) * 255).toString(16).padStart(2, '0');
  const alpha = clamp(value.a) < 0.999 ? byte(value.a) : '';
  return `#${byte(value.r)}${byte(value.g)}${byte(value.b)}${alpha}`;
}

export function parseColor(text: string, space: ColorSpace): ColorValue | null {
  const value = clean(text);
  if (space === 'named') return parseHex(NAMED[value] ?? value);
  if (space === 'hex') return parseHex(value);
  const functionMatch = /^([a-z]+)\((.*)\)$/i.exec(value);
  if (!functionMatch || functionMatch[1].toLowerCase() !== space) return null;
  const sections = functionMatch[2].split('/');
  if (sections.length > 2) return null;
  const base = sections[0].replaceAll(',', ' ').trim().split(/\s+/).filter(Boolean);
  const expected = space === 'cmyk' ? 4 : 3;
  let alphaToken = sections[1]?.trim();
  if (!alphaToken && base.length === expected + 1 && (space === 'rgb' || space === 'hsl' || space === 'hsv' || space === 'hsb')) alphaToken = base.pop() ?? '';
  if (base.length !== expected || (alphaToken && !/^-?(?:\d+\.?\d*|\.\d+)%?$/.test(alphaToken))) return null;
  const parsed = base.map((part) => ({ value: Number.parseFloat(part), percent: part.endsWith('%') }));
  if (parsed.some((part) => !Number.isFinite(part.value))) return null;
  const alphaRaw = alphaToken ? Number.parseFloat(alphaToken) : 1;
  const alpha = alphaToken?.endsWith('%') ? alphaRaw / 100 : alphaRaw;
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return null;
  const numbers = parsed.map((part) => part.percent ? part.value / 100 : part.value);
  if (space === 'rgb') {
    const channels = parsed.map((part) => part.percent ? part.value / 100 : part.value / 255);
    return { r: channels[0], g: channels[1], b: channels[2], a: alpha };
  }
  if (space === 'hsl') {
    return hslToRgb(numbers[0], numbers[1], numbers[2], alpha);
  }
  if (space === 'hsv' || space === 'hsb') {
    return hsvToRgb(numbers[0], numbers[1], numbers[2], alpha);
  }
  if (space === 'hwb') {
    const w = numbers[1]; const bl = numbers[2];
    const base = hsvToRgb(numbers[0], 1, 1, alpha); const factor = w + bl >= 1 ? 0 : (1 - w - bl);
    return { r: base.r * factor + w, g: base.g * factor + w, b: base.b * factor + w, a: alpha };
  }
  if (space === 'cmyk') {
    const c = numbers[0]; const m = numbers[1]; const y = numbers[2]; const k = numbers[3];
    return { r: (1 - c) * (1 - k), g: (1 - m) * (1 - k), b: (1 - y) * (1 - k), a: alpha };
  }
  if (space === 'lab' || space === 'lch' || space === 'oklab' || space === 'oklch') {
    const colorNumbers = [...numbers];
    if (!space.startsWith('ok') && parsed[0].percent) colorNumbers[0] = parsed[0].value;
    const rgb = space.startsWith('ok') ? parseOklab(colorNumbers, space === 'oklch', alpha) : parseLab(colorNumbers, space === 'lch', alpha);
    return rgb;
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number, a = 1): ColorValue {
  const hue = ((h % 360) + 360) % 360 / 60; const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(hue % 2 - 1)); const m = l - c / 2;
  const rgb = hue < 1 ? [c, x, 0] : hue < 2 ? [x, c, 0] : hue < 3 ? [0, c, x] : hue < 4 ? [0, x, c] : hue < 5 ? [x, 0, c] : [c, 0, x];
  return { r: rgb[0] + m, g: rgb[1] + m, b: rgb[2] + m, a };
}
function hsvToRgb(h: number, s: number, v: number, a = 1): ColorValue {
  const hue = ((h % 360) + 360) % 360 / 60; const c = v * s; const x = c * (1 - Math.abs(hue % 2 - 1)); const m = v - c;
  const rgb = hue < 1 ? [c, x, 0] : hue < 2 ? [x, c, 0] : hue < 3 ? [0, c, x] : hue < 4 ? [0, x, c] : hue < 5 ? [x, 0, c] : [c, 0, x];
  return { r: rgb[0] + m, g: rgb[1] + m, b: rgb[2] + m, a };
}
function parseLab(n: number[], lch: boolean, a: number): ColorValue {
  const L = n[0]; const A = lch ? n[1] * Math.cos((n[2] * Math.PI) / 180) : n[1]; const B = lch ? n[1] * Math.sin((n[2] * Math.PI) / 180) : n[2];
  const fy = (L + 16) / 116; const fx = A / 500 + fy; const fz = fy - B / 200; const f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const xyz = [f(fx) * 0.95047, f(fy), f(fz) * 1.08883];
  return xyzToRgb(xyz[0], xyz[1], xyz[2], a);
}
function parseOklab(n: number[], lch: boolean, a: number): ColorValue {
  const L = n[0] > 1 ? n[0] / 100 : n[0]; const A = lch ? n[1] * Math.cos((n[2] * Math.PI) / 180) : n[1]; const B = lch ? n[1] * Math.sin((n[2] * Math.PI) / 180) : n[2];
  const l = L + 0.3963377774 * A + 0.2158037573 * B; const m = L - 0.1055613458 * A - 0.0638541728 * B; const s = L - 0.0894841775 * A - 1.291485548 * B;
  const l3 = l ** 3; const m3 = m ** 3; const s3 = s ** 3;
  return { r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3, g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3, b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3, a };
}
function xyzToRgb(x: number, y: number, z: number, a: number): ColorValue {
  const linear = [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
  const encode = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;
  return { r: encode(linear[0]), g: encode(linear[1]), b: encode(linear[2]), a };
}

function rgbToHsl(v: ColorValue): [number, number, number] {
  const max = Math.max(v.r, v.g, v.b); const min = Math.min(v.r, v.g, v.b); const d = max - min; let h = 0;
  if (d) h = max === v.r ? 60 * (((v.g - v.b) / d) % 6) : max === v.g ? 60 * ((v.b - v.r) / d + 2) : 60 * ((v.r - v.g) / d + 4);
  const l = (max + min) / 2; return [((h % 360) + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
}
function rgbToHsv(v: ColorValue): [number, number, number] { const max = Math.max(v.r, v.g, v.b); const min = Math.min(v.r, v.g, v.b); const d = max - min; const [h] = rgbToHsl(v); return [h, max ? d / max : 0, max]; }
function rgbToLab(v: ColorValue): [number, number, number] {
  const linear = [v.r, v.g, v.b].map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = (linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722);
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const f = (value: number) => value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116;
  const fx = f(x); const fy = f(y); const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function rgbToOklab(v: ColorValue): [number, number, number] {
  const l = 0.4122214708 * v.r + 0.5363325363 * v.g + 0.0514459929 * v.b;
  const m = 0.2119034982 * v.r + 0.6806995451 * v.g + 0.1073969566 * v.b;
  const s = 0.0883024619 * v.r + 0.2817188376 * v.g + 0.6299787005 * v.b;
  const l3 = Math.cbrt(l); const m3 = Math.cbrt(m); const s3 = Math.cbrt(s);
  return [0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3, 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3, 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3];
}
function nameFor(v: ColorValue): string | null { const hex = toHex({ ...v, a: 1 }); return Object.entries(NAMED).find(([, candidate]) => candidate === hex)?.[0] ?? null; }
export function translate(value: ColorValue, space: ColorSpace): ColorTranslation {
  const clipped = value.r < 0 || value.r > 1 || value.g < 0 || value.g > 1 || value.b < 0 || value.b > 1;
  if (space === 'named') return { space, text: value.a < 0.999 ? toHex(value) : (nameFor(value) ?? toHex(value)), value, clipped, gamut: 'srgb' };
  if (space === 'hex') return { space, text: toHex(value), value, clipped, gamut: 'srgb' };
  if (space === 'rgb') return { space, text: `rgb(${round(value.r * 255)} ${round(value.g * 255)} ${round(value.b * 255)} / ${round(value.a * 100)}%)`, value, clipped, gamut: 'srgb' };
  if (space === 'hsl') { const [h, s, l] = rgbToHsl(value); return { space, text: `hsl(${round(h)} ${round(s * 100)}% ${round(l * 100)}% / ${round(value.a * 100)}%)`, value, clipped, gamut: 'srgb' }; }
  if (space === 'hsv' || space === 'hsb') { const [h, s, v] = rgbToHsv(value); return { space, text: `${space}(${round(h)} ${round(s * 100)}% ${round(v * 100)}% / ${round(value.a * 100)}%)`, value, clipped, gamut: 'srgb' }; }
  if (space === 'hwb') { const [h] = rgbToHsv(value); return { space, text: `hwb(${round(h)} ${round(Math.min(value.r, value.g, value.b) * 100)}% ${round((1 - Math.max(value.r, value.g, value.b)) * 100)}% / ${round(value.a * 100)}%)`, value, clipped, gamut: 'srgb' }; }
  if (space === 'cmyk') { const k = 1 - Math.max(value.r, value.g, value.b); const d = 1 - k || 1; return { space, text: `cmyk(${round((1 - value.r - k) / d * 100)}% ${round((1 - value.g - k) / d * 100)}% ${round((1 - value.b - k) / d * 100)}% ${round(k * 100)}% / ${round(value.a * 100)}%)`, value, clipped, gamut: 'srgb' }; }
  if (space === 'lab' || space === 'lch') {
    const [L, A, B] = rgbToLab(value); const C = Math.hypot(A, B); const H = (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
    return { space, text: space === 'lab' ? `lab(${round(L)}% ${round(A)} ${round(B)} / ${round(value.a * 100)}%)` : `lch(${round(L)}% ${round(C)} ${round(H)} / ${round(value.a * 100)}%)`, value, clipped, gamut: 'srgb' };
  }
  const [L, A, B] = rgbToOklab(value); const C = Math.hypot(A, B); const H = (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
  return { space, text: space === 'oklab' ? `oklab(${round(L)} ${round(A)} ${round(B)} / ${round(value.a * 100)}%)` : `oklch(${round(L)} ${round(C)} ${round(H)} / ${round(value.a * 100)}%)`, value, clipped, gamut: 'srgb' };
}

export const COLOR_SPACES: readonly ColorSpace[] = ['named', 'hex', 'rgb', 'hsl', 'hsv', 'hsb', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'cmyk'];
