import { describe, expect, it } from 'vitest';
import { COLOR_SPACES, parseColor, toHex, translate } from '../src/renderer/color-translator';

describe('appearance colour translator', () => {
  it('round-trips every supported representation with alpha', () => {
    const source = parseColor('#6750a4cc', 'hex');
    expect(source).not.toBeNull();
    for (const space of COLOR_SPACES) {
      const text = translate(source!, space).text;
      const parsed = parseColor(text, space);
      expect(parsed, space).not.toBeNull();
      expect(toHex(parsed!), space).toBe('#6750a4cc');
      expect(translate(source!, space).gamut, space).toBe('srgb');
    }
  });

  it('accepts named colours and the HSV/HSB aliases', () => {
    expect(toHex(parseColor('rebeccapurple', 'named')!)).toBe('#663399');
    expect(toHex(parseColor('hsb(0 100% 100% / 50%)', 'hsb')!)).toBe('#ff000080');
  });

  it('keeps out-of-gamut values observable for a clipping warning', () => {
    const value = parseColor('lab(80 140 120 / 100%)', 'lab');
    expect(value).not.toBeNull();
    expect(translate(value!, 'lab').clipped).toBe(true);
    expect(translate(parseColor('rgb(300 0 0 / 50%)', 'rgb')!, 'rgb').clipped).toBe(true);
  });

  it('rejects malformed or unbounded input instead of silently clamping', () => {
    expect(parseColor('#fff', 'hex')).toBeNull();
    expect(parseColor('rgb(nope)', 'rgb')).toBeNull();
    expect(parseColor('hsl(20 200% 50%)', 'hsl')).not.toBeNull();
    expect(parseColor('rgb(1 2 3 garbage)', 'rgb')).toBeNull();
    expect(parseColor('rgb(1 2 3 4 5)', 'rgb')).toBeNull();
    expect(parseColor('rgb(0 0 0 / 200%)', 'rgb')).toBeNull();
  });
});
