import {
  ACCENT_ALIAS_STEPS,
  SCALE_CSS_TARGETS,
  SEMANTIC_ONLY_TOKENS,
  TOKEN_CSS_TARGETS,
  UNMAPPED_TOKENS,
  UPSTREAM_BASE_COMMIT,
} from './adapterConstants';
import { COMPONENT_TOKEN_ALIASES, TOKEN_CATALOG } from '../tokens/tokenCatalog';
import {
  type CompatibilityIssue,
  type CompatibilityResult,
  type CssVariableBlock,
  type ResolvedTokenMap,
  type TokenMode,
  type TwentyBrandingAdapter,
} from '../types/branding.types';

const mapModeTokens = (tokens: ResolvedTokenMap): CssVariableBlock => {
  const block: CssVariableBlock = {};

  for (const [path, value] of Object.entries(tokens)) {
    const targets = TOKEN_CSS_TARGETS[path];

    if (targets !== undefined) {
      for (const target of targets) {
        block[target] = String(value);
      }
      continue;
    }

    const scaleMatch = path.match(/^brand\.scale\.(\d{1,2})$/);

    if (scaleMatch !== null) {
      for (const target of SCALE_CSS_TARGETS(Number(scaleMatch[1]))) {
        block[target] = String(value);
      }
    }
  }

  // Accent aliases follow the scale steps deterministically.
  for (const [aliasVariable, step] of Object.entries(ACCENT_ALIAS_STEPS)) {
    const stepValue = tokens[`brand.scale.${step}`];

    if (stepValue !== undefined) {
      block[aliasVariable] = String(stepValue);
    }
  }

  return block;
};

export const twenty538b1808Adapter: TwentyBrandingAdapter = {
  version: 'o2d-adapter/538b1808@1',
  supportedRange: { baseCommit: UPSTREAM_BASE_COMMIT },

  mapThemeTokens: (resolved) => ({
    light: mapModeTokens(resolved.light),
    dark: mapModeTokens(resolved.dark),
  }),

  // Phase 1: slots pass through by asset ID; URL resolution and the actual
  // rewiring of favicon/logos arrive with the asset pipeline (phase 3).
  mapAssets: (assets) =>
    Object.fromEntries(
      Object.entries(assets).map(([slot, ref]) => [slot, ref?.assetId ?? '']),
    ),

  mapGlobalPoints: () => ({
    titleFallback: {
      file: 'packages/twenty-front/index.html',
      expected: '<title>Twenty</title>',
    },
    faviconLink: {
      file: 'packages/twenty-front/index.html',
      expected: '/images/icons/android/android-launchericon-48-48.png',
    },
    manifestUrl: {
      file: 'packages/twenty-front/index.html',
      expected: '/manifest.json',
    },
  }),

  mapComponents: () => ({ ...COMPONENT_TOKEN_ALIASES }),

  validateCompatibility: (availableCssVariables) => {
    const issues: CompatibilityIssue[] = [];

    const checkTargets = (path: string, targets: string[]): void => {
      for (const target of targets) {
        const missingModes = (['light', 'dark'] as TokenMode[]).filter(
          (mode) => !availableCssVariables[mode].has(target),
        );

        if (missingModes.length > 0) {
          const tier = TOKEN_CATALOG[path]?.tier;

          issues.push({
            tokenPath: path,
            kind: 'missing',
            severity:
              tier === 'required' || tier === 'calculated'
                ? 'blocking'
                : 'warning',
            suggestedAction: `variable ${target} not found in installed theme CSS (${missingModes.join(', ')}) — regenerate the adapter against the new base`,
          });
        }
      }
    };

    for (const [path, targets] of Object.entries(TOKEN_CSS_TARGETS)) {
      checkTargets(path, targets);
    }

    for (let step = 1; step <= 12; step += 1) {
      checkTargets(`brand.scale.${step}`, SCALE_CSS_TARGETS(step));
    }

    checkTargets('brand.scale.aliases', Object.keys(ACCENT_ALIAS_STEPS));

    // Unmapped catalog tokens are a known, accepted gap in this base.
    for (const path of UNMAPPED_TOKENS) {
      if (!SEMANTIC_ONLY_TOKENS.has(path)) {
        issues.push({
          tokenPath: path,
          kind: 'missing',
          severity: 'warning',
          suggestedAction:
            'no CSS variable target in base 538b1808 — token is preserved in the abstract model only',
        });
      }
    }

    const hasBlocking = issues.some((issue) => issue.severity === 'blocking');

    return {
      status: hasBlocking
        ? 'incompatible'
        : issues.length > 0
          ? 'degraded'
          : 'compatible',
      issues,
    };
  },
};
