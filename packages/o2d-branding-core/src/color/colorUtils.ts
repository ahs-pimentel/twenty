// Color parsing and math needed by validation (contrast) and scale
// generation. Supports the exact syntaxes present in the Twenty theme CSS:
// hex (#rgb/#rgba/#rrggbb/#rrggbbaa), rgb()/rgba() and color(display-p3 ...).

export type ParsedColor = {
  // Components in the 0–1 range, in the color's own space.
  r: number;
  g: number;
  b: number;
  alpha: number;
  space: 'srgb' | 'display-p3';
};

const HEX_PATTERN = /^#([0-9a-f]{3,8})$/i;
const RGB_PATTERN = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i;
const DISPLAY_P3_PATTERN = /^color\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.%]+)\s*)?\)$/i;

const parseAlphaChannel = (raw: string | undefined): number => {
  if (raw === undefined) {
    return 1;
  }

  return raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
};

export const parseCssColor = (value: string): ParsedColor | null => {
  const trimmed = value.trim();

  const hexMatch = trimmed.match(HEX_PATTERN);

  if (hexMatch) {
    const hex = hexMatch[1];

    if (![3, 4, 6, 8].includes(hex.length)) {
      return null;
    }

    const expand =
      hex.length <= 4
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;

    const r = parseInt(expand.slice(0, 2), 16) / 255;
    const g = parseInt(expand.slice(2, 4), 16) / 255;
    const b = parseInt(expand.slice(4, 6), 16) / 255;
    const alpha =
      expand.length === 8 ? parseInt(expand.slice(6, 8), 16) / 255 : 1;

    return { r, g, b, alpha, space: 'srgb' };
  }

  const rgbMatch = trimmed.match(RGB_PATTERN);

  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]) / 255,
      g: Number(rgbMatch[2]) / 255,
      b: Number(rgbMatch[3]) / 255,
      alpha: parseAlphaChannel(rgbMatch[4]),
      space: 'srgb',
    };
  }

  const p3Match = trimmed.match(DISPLAY_P3_PATTERN);

  if (p3Match) {
    return {
      r: Number(p3Match[1]),
      g: Number(p3Match[2]),
      b: Number(p3Match[3]),
      alpha: parseAlphaChannel(p3Match[4]),
      space: 'display-p3',
    };
  }

  return null;
};

export const isParsableColor = (value: string): boolean =>
  parseCssColor(value) !== null;

// Both sRGB and Display-P3 use the sRGB transfer function.
const linearize = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);

const delinearize = (channel: number): number =>
  channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

// Y rows of the RGB→XYZ (D65) matrices.
const SRGB_Y = [0.2126729, 0.7151522, 0.072175];
const P3_Y = [0.2289746, 0.6917385, 0.0792869];

export const relativeLuminance = (color: ParsedColor): number => {
  const [rl, gl, bl] = [color.r, color.g, color.b].map(linearize);
  const row = color.space === 'display-p3' ? P3_Y : SRGB_Y;

  return row[0] * rl + row[1] * gl + row[2] * bl;
};

// WCAG contrast; alpha < 1 foregrounds are composited over the background
// before measuring, so semi-transparent tokens are judged by what users see.
export const contrastRatio = (
  foreground: ParsedColor,
  background: ParsedColor,
): number => {
  const composited =
    foreground.alpha < 1
      ? compositeOver(foreground, background)
      : foreground;

  const lumA = relativeLuminance(composited);
  const lumB = relativeLuminance(background);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  return (lighter + 0.05) / (darker + 0.05);
};

const compositeOver = (
  foreground: ParsedColor,
  background: ParsedColor,
): ParsedColor => {
  const toLinearSrgb = (color: ParsedColor) => srgbFromParsed(color);
  const fg = toLinearSrgb(foreground);
  const bg = toLinearSrgb(background);
  const alpha = foreground.alpha;

  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
    alpha: 1,
    space: 'srgb',
  };
};

// Display-P3 → sRGB via XYZ (D65), gamut-clamped per channel.
const P3_TO_XYZ = [
  [0.4865709, 0.2656677, 0.1982173],
  [0.2289746, 0.6917385, 0.0792869],
  [0.0, 0.0451134, 1.0439444],
];

const XYZ_TO_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
];

const multiplyMatrix = (matrix: number[][], vector: number[]): number[] =>
  matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);

export const srgbFromParsed = (color: ParsedColor): ParsedColor => {
  if (color.space === 'srgb') {
    return color;
  }

  const linear = [color.r, color.g, color.b].map(linearize);
  const xyz = multiplyMatrix(P3_TO_XYZ, linear);
  const [r, g, b] = multiplyMatrix(XYZ_TO_SRGB, xyz).map((channel) =>
    Math.min(1, Math.max(0, channel)),
  );

  return {
    r: delinearize(r),
    g: delinearize(g),
    b: delinearize(b),
    alpha: color.alpha,
    space: 'srgb',
  };
};

export type Oklch = { l: number; c: number; h: number };

// Linear sRGB → OKLab (Björn Ottosson's reference matrices).
const srgbToOklab = (color: ParsedColor): { l: number; a: number; b: number } => {
  const srgb = srgbFromParsed(color);
  const [r, g, b] = [srgb.r, srgb.g, srgb.b].map(linearize);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lCbrt = Math.cbrt(l);
  const mCbrt = Math.cbrt(m);
  const sCbrt = Math.cbrt(s);

  return {
    l: 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt,
    a: 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt,
    b: 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt,
  };
};

export const toOklch = (color: ParsedColor): Oklch => {
  const { l, a, b } = srgbToOklab(color);
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;

  if (h < 0) {
    h += 360;
  }

  return { l, c, h };
};

const oklabToLinearSrgb = (
  l: number,
  a: number,
  b: number,
): [number, number, number] => {
  const lPart = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPart = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPart = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = lPart * lPart * lPart;
  const m3 = mPart * mPart * mPart;
  const s3 = sPart * sPart * sPart;

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
};

const isInSrgbGamut = (linear: [number, number, number]): boolean =>
  linear.every((channel) => channel >= -1e-6 && channel <= 1 + 1e-6);

// OKLCH → sRGB hex, reducing chroma toward zero until in gamut so the
// mapping stays deterministic without hue shifts.
export const oklchToHex = (oklch: Oklch): string => {
  const hueRadians = (oklch.h * Math.PI) / 180;
  let chroma = oklch.c;
  let linear = oklabToLinearSrgb(
    oklch.l,
    chroma * Math.cos(hueRadians),
    chroma * Math.sin(hueRadians),
  );

  if (!isInSrgbGamut(linear)) {
    let low = 0;
    let high = chroma;

    for (let iteration = 0; iteration < 32; iteration += 1) {
      chroma = (low + high) / 2;
      linear = oklabToLinearSrgb(
        oklch.l,
        chroma * Math.cos(hueRadians),
        chroma * Math.sin(hueRadians),
      );

      if (isInSrgbGamut(linear)) {
        low = chroma;
      } else {
        high = chroma;
      }
    }

    linear = oklabToLinearSrgb(
      oklch.l,
      low * Math.cos(hueRadians),
      low * Math.sin(hueRadians),
    );
  }

  const toByte = (channel: number): string => {
    const clamped = Math.min(1, Math.max(0, delinearize(Math.max(0, channel))));

    return Math.round(clamped * 255)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${toByte(linear[0])}${toByte(linear[1])}${toByte(linear[2])}`;
};

// Perceptual distance in OKLab (used by A5/A7 checks).
export const oklabDistance = (colorA: ParsedColor, colorB: ParsedColor): number => {
  const a = srgbToOklab(colorA);
  const b = srgbToOklab(colorB);

  return Math.sqrt(
    (a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2,
  );
};
