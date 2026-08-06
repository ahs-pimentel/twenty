import {
  contrastRatio,
  oklchToHex,
  parseCssColor,
  toOklch,
} from '../color/colorUtils';
import { generateBrandScale } from '../color/generateBrandScale';

describe('parseCssColor', () => {
  it('parses hex, rgb and display-p3 syntaxes', () => {
    expect(parseCssColor('#fff')).toEqual({
      r: 1,
      g: 1,
      b: 1,
      alpha: 1,
      space: 'srgb',
    });
    expect(parseCssColor('#20202080')?.alpha).toBeCloseTo(0.5, 1);
    expect(parseCssColor('rgb(255, 0, 0)')).toMatchObject({ r: 1, g: 0, b: 0 });
    expect(parseCssColor('color(display-p3 0.276 0.384 0.837)')).toMatchObject({
      space: 'display-p3',
    });
    expect(
      parseCssColor('color(display-p3 0 0 0 / 0.361)')?.alpha,
    ).toBeCloseTo(0.361);
  });

  it('rejects malformed values', () => {
    expect(parseCssColor('blue')).toBeNull();
    expect(parseCssColor('url(#x)')).toBeNull();
    expect(parseCssColor('#ggg')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values at the extremes', () => {
    const white = parseCssColor('#ffffff')!;
    const black = parseCssColor('#000000')!;

    expect(contrastRatio(white, black)).toBeCloseTo(21, 0);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it('meets AA for the Twenty defaults that anchor A1/A2', () => {
    const textPrimary = parseCssColor('color(display-p3 0.2 0.2 0.2)')!;
    const backgroundPrimary = parseCssColor('color(display-p3 1 1 1)')!;
    const solidAccent = parseCssColor('color(display-p3 0.276 0.384 0.837)')!;
    const white = parseCssColor('#ffffff')!;

    expect(contrastRatio(textPrimary, backgroundPrimary)).toBeGreaterThan(4.5);
    expect(contrastRatio(white, solidAccent)).toBeGreaterThan(3);
  });
});

describe('oklch round-trip', () => {
  it('reconverts colors with low perceptual error', () => {
    for (const hex of ['#0f6b3c', '#c0392b', '#123456', '#f5a623']) {
      const oklch = toOklch(parseCssColor(hex)!);
      const roundTripped = oklchToHex(oklch);
      const original = toOklch(parseCssColor(roundTripped)!);

      expect(Math.abs(original.l - oklch.l)).toBeLessThan(0.01);
    }
  });
});

describe('generateBrandScale', () => {
  it('is deterministic and anchors step 9 to the input color', () => {
    const first = generateBrandScale('#0f6b3c', 'light');
    const second = generateBrandScale('#0f6b3c', 'light');

    expect(first).toEqual(second);
    expect(first.scale).toHaveLength(12);
    expect(first.scale[8]).toBe('#0f6b3c');
    expect(first.issues).toEqual([]);
  });

  it('follows the reference lightness curve in both modes', () => {
    const light = generateBrandScale('#0f6b3c', 'light').scale;
    const dark = generateBrandScale('#0f6b3c', 'dark').scale;

    const lightnessOf = (value: string) => toOklch(parseCssColor(value)!).l;

    // Light mode walks from near-white to dark; dark mode the other way.
    expect(lightnessOf(light[0])).toBeGreaterThan(lightnessOf(light[11]));
    expect(lightnessOf(dark[0])).toBeLessThan(lightnessOf(dark[11]));
    expect(light).toMatchSnapshot();
    expect(dark).toMatchSnapshot();
  });

  it('flags scales whose critical steps cannot meet contrast', () => {
    const { issues } = generateBrandScale('#ffff99', 'light');

    expect(issues.some((issue) => issue.rule.startsWith('brandScale.'))).toBe(
      true,
    );
  });

  it('reports unparsable brand colors instead of throwing', () => {
    const { scale, issues } = generateBrandScale('nope', 'light');

    expect(scale).toEqual([]);
    expect(issues[0].rule).toBe('brandScale.invalidColor');
  });
});
