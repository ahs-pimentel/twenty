import { canonicalHash } from './canonicalHash';
import { generateBrandScale } from '../color/generateBrandScale';
import { getPreset } from '../presets/presetRegistry';
import {
  type ModedTokenValue,
  type O2DBrandingConfig,
  type O2DResolvedBranding,
  type ResolvedTokenMap,
  type TokenMode,
  type TokenValue,
  type ValidationIssue,
} from '../types/branding.types';

export type NormalizationResult = {
  resolved: O2DResolvedBranding | null;
  issues: ValidationIssue[];
  // Paths explicitly set by the client config (used by validation to tell
  // customizations apart from baseline-inherited values).
  overriddenPaths: ReadonlySet<string>;
  // Paths computed by the core's own deterministic derivation — these carry
  // the upstream visual profile, so validation treats them like baseline.
  derivedPaths: ReadonlySet<string>;
};

export type NormalizationOptions = {
  generatedAt?: string;
};

const MODES: TokenMode[] = ['light', 'dark'];

const isModedValue = (
  value: TokenValue | ModedTokenValue,
): value is ModedTokenValue =>
  typeof value === 'object' && value !== null && 'light' in value;

// Derivation sources: overriding a background re-derives the surface built
// on it unless the surface itself was overridden (baseline semantics of the
// twenty-default extraction).
const SURFACE_DERIVATIONS: Array<[source: string, target: string]> = [
  ['background.secondary', 'surface.primary'],
  ['background.tertiary', 'surface.secondary'],
  ['background.primary', 'surface.elevated'],
];

// Sparse config → dense deterministic per-mode maps + canonical hash
// (doc 06 §3). Pure and total: invalid semantics surface as issues, never
// as throws.
export const normalizeBrandingConfig = (
  config: O2DBrandingConfig,
  options: NormalizationOptions = {},
): NormalizationResult => {
  const issues: ValidationIssue[] = [];
  const preset = getPreset(config.basePreset);

  if (preset === undefined) {
    return {
      resolved: null,
      issues: [
        {
          rule: 'preset.unknown',
          severity: 'error',
          message: `unknown base preset "${config.basePreset}"`,
        },
      ],
      overriddenPaths: new Set(),
      derivedPaths: new Set(),
    };
  }

  const tokens: { light: ResolvedTokenMap; dark: ResolvedTokenMap } = {
    light: {},
    dark: {},
  };

  for (const [path, modedValue] of Object.entries(preset.tokens)) {
    tokens.light[path] = modedValue.light;
    tokens.dark[path] = modedValue.dark;
  }

  const overriddenPaths = new Set<string>();
  const derivedPaths = new Set<string>();

  for (const [path, value] of Object.entries(config.tokens)) {
    overriddenPaths.add(path);

    if (isModedValue(value)) {
      tokens.light[path] = value.light;
      tokens.dark[path] = value.dark;
    } else {
      tokens.light[path] = value;
      tokens.dark[path] = value;
    }
  }

  for (const mode of MODES) {
    const brandPrimary = tokens[mode]['brand.primary'];
    const presetBrandPrimary = preset.tokens['brand.primary']?.[mode];

    // The brand scale is recalculated only when the brand color moved away
    // from the preset baseline — otherwise the preset's own scale stays,
    // which is what keeps the neutral round-trip byte-identical (doc 26,
    // phase 1 acceptance).
    if (
      typeof brandPrimary === 'string' &&
      brandPrimary !== presetBrandPrimary
    ) {
      const { scale, issues: scaleIssues } = generateBrandScale(
        brandPrimary,
        mode,
      );

      issues.push(...scaleIssues);

      if (scale.length === 12) {
        for (let step = 1; step <= 12; step += 1) {
          tokens[mode][`brand.scale.${step}`] = scale[step - 1];
          derivedPaths.add(`brand.scale.${step}`);
        }

        if (!overriddenPaths.has('border.focus')) {
          tokens[mode]['border.focus'] = scale[6];
          derivedPaths.add('border.focus');
        }

        if (!overriddenPaths.has('brand.primaryHover')) {
          tokens[mode]['brand.primaryHover'] = scale[9];
          derivedPaths.add('brand.primaryHover');
        }

        if (!overriddenPaths.has('brand.primaryActive')) {
          tokens[mode]['brand.primaryActive'] = scale[10];
          derivedPaths.add('brand.primaryActive');
        }
      }
    }

    for (const [source, target] of SURFACE_DERIVATIONS) {
      if (overriddenPaths.has(source) && !overriddenPaths.has(target)) {
        tokens[mode][target] = tokens[mode][source];
        derivedPaths.add(target);
      }
    }
  }

  const hashedPayload = {
    schemaVersion: config.schemaVersion,
    basePreset: config.basePreset,
    brand: config.brand,
    tokens,
    assets: config.assets,
  };

  return {
    resolved: {
      tokens,
      assets: config.assets,
      meta: {
        hash: canonicalHash(hashedPayload),
        schemaVersion: config.schemaVersion,
        basePreset: config.basePreset,
        generatedAt: options.generatedAt,
      },
    },
    issues,
    overriddenPaths,
    derivedPaths,
  };
};
