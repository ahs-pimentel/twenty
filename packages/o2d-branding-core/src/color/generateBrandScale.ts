import {
  contrastRatio,
  oklchToHex,
  parseCssColor,
  toOklch,
} from './colorUtils';
import { type TokenMode, type ValidationIssue } from '../types/branding.types';

// Reference curves = the Radix indigoP3 scale exactly as shipped in the
// Twenty theme CSS (base commit 538b1808). The generator keeps each step's
// reference lightness, transplants the brand hue, and scales chroma by the
// ratio between the brand color and the reference solid step (9).
const REFERENCE_SCALE_LIGHT = [
  'color(display-p3 0.992 0.992 0.996)',
  'color(display-p3 0.971 0.977 0.998)',
  'color(display-p3 0.933 0.948 0.992)',
  'color(display-p3 0.885 0.914 1)',
  'color(display-p3 0.831 0.87 1)',
  'color(display-p3 0.767 0.814 0.995)',
  'color(display-p3 0.685 0.74 0.957)',
  'color(display-p3 0.569 0.639 0.916)',
  'color(display-p3 0.276 0.384 0.837)',
  'color(display-p3 0.234 0.343 0.801)',
  'color(display-p3 0.256 0.354 0.755)',
  'color(display-p3 0.133 0.175 0.348)',
];

const REFERENCE_SCALE_DARK = [
  'color(display-p3 0.068 0.074 0.118)',
  'color(display-p3 0.081 0.089 0.144)',
  'color(display-p3 0.105 0.141 0.275)',
  'color(display-p3 0.129 0.18 0.369)',
  'color(display-p3 0.163 0.22 0.439)',
  'color(display-p3 0.203 0.262 0.5)',
  'color(display-p3 0.245 0.309 0.575)',
  'color(display-p3 0.285 0.362 0.674)',
  'color(display-p3 0.276 0.384 0.837)',
  'color(display-p3 0.354 0.445 0.866)',
  'color(display-p3 0.63 0.69 1)',
  'color(display-p3 0.848 0.881 0.99)',
];

const SOLID_STEP_INDEX = 8; // step 9, zero-based

export type BrandScaleResult = {
  scale: string[];
  issues: ValidationIssue[];
};

// Deterministic 12-step scale from a single brand color (doc 09 §2.4).
// Same input ⇒ same output; the caller hashes the result into the version
// snapshot. Contrast problems are reported, never silently corrected.
export const generateBrandScale = (
  brandPrimary: string,
  mode: TokenMode,
): BrandScaleResult => {
  const issues: ValidationIssue[] = [];
  const parsed = parseCssColor(brandPrimary);

  if (parsed === null) {
    return {
      scale: [],
      issues: [
        {
          rule: 'brandScale.invalidColor',
          severity: 'error',
          message: `brand.primary value "${brandPrimary}" is not a parsable color`,
          tokenPath: 'brand.primary',
          mode,
        },
      ],
    };
  }

  const reference =
    mode === 'light' ? REFERENCE_SCALE_LIGHT : REFERENCE_SCALE_DARK;
  const referenceOklch = reference.map((value) =>
    toOklch(parseCssColor(value) as NonNullable<ReturnType<typeof parseCssColor>>),
  );
  const referenceSolid = referenceOklch[SOLID_STEP_INDEX];
  const brand = toOklch(parsed);

  const chromaRatio =
    referenceSolid.c === 0 ? 0 : Math.min(brand.c / referenceSolid.c, 1.35);

  const scale = referenceOklch.map((step, index) => {
    if (index === SOLID_STEP_INDEX) {
      // Step 9 is the brand color itself, verbatim.
      return brandPrimary;
    }

    return oklchToHex({
      l: step.l,
      c: step.c * chromaRatio,
      h: brand.h,
    });
  });

  // Doc 09 §2.4: step 9 must work as a solid (≥ 3:1 against the mode's page
  // background feel — approximated by step 1) and step 11 as text (≥ 4.5:1
  // against steps 1–2).
  const solid = parseCssColor(scale[SOLID_STEP_INDEX]);
  const textStep = parseCssColor(scale[10]);
  const surfaceStep = parseCssColor(scale[0]);

  if (solid !== null && surfaceStep !== null) {
    const measured = contrastRatio(solid, surfaceStep);

    if (measured < 3) {
      issues.push({
        rule: 'brandScale.solidContrast',
        severity: 'error',
        message:
          'generated step 9 does not reach 3:1 contrast against step 1 — brand color too close to the background range',
        tokenPath: 'brand.scale.9',
        mode,
        measured: measured.toFixed(2),
        required: '3.00',
      });
    }
  }

  if (textStep !== null && surfaceStep !== null) {
    const measured = contrastRatio(textStep, surfaceStep);

    if (measured < 4.5) {
      issues.push({
        rule: 'brandScale.textContrast',
        severity: 'error',
        message:
          'generated step 11 does not reach 4.5:1 contrast against step 1 — unusable as text color',
        tokenPath: 'brand.scale.11',
        mode,
        measured: measured.toFixed(2),
        required: '4.50',
      });
    }
  }

  return { scale, issues };
};
