import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACCENT_ALIAS_STEPS,
  TOKEN_CSS_TARGETS,
  UPSTREAM_BASE_COMMIT,
} from '../src/adapters/adapterConstants';
import { parseThemeCssVariables } from '../src/css/parseThemeCssVariables';
import { type O2DBrandingPreset } from '../src/types/branding.types';

// Regenerates preset.twenty-default from the installed theme CSS — the
// preset is never maintained by hand (doc 06 §5). Run with:
//   npx tsx scripts/generateTwentyDefaultPreset.ts
// The preset parity test fails whenever the committed JSON drifts from the
// CSS, which is the signal to re-run this script (or the upstream bridge).

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

const themeCssDirectory = join(
  scriptDirectory,
  '../../twenty-ui/src/theme-constants',
);

export const buildTwentyDefaultPreset = (
  lightCssText: string,
  darkCssText: string,
): O2DBrandingPreset => {
  const light = parseThemeCssVariables(lightCssText);
  const dark = parseThemeCssVariables(darkCssText);

  const tokens: O2DBrandingPreset['tokens'] = {};

  const setToken = (path: string, lightValue: string, darkValue: string) => {
    tokens[path] = { light: lightValue, dark: darkValue };
  };

  for (const [path, targets] of Object.entries(TOKEN_CSS_TARGETS)) {
    const target = targets[0];

    if (light[target] === undefined || dark[target] === undefined) {
      throw new Error(`missing ${target} in installed theme CSS`);
    }

    setToken(path, light[target], dark[target]);
  }

  for (let step = 1; step <= 12; step += 1) {
    const target = `--t-accent-accent${step}`;

    setToken(`brand.scale.${step}`, light[target], dark[target]);
  }

  // Consistency guard: the accent aliases must match the steps the adapter
  // derives them from, in both modes.
  for (const [aliasVariable, step] of Object.entries(ACCENT_ALIAS_STEPS)) {
    for (const [mode, variables] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      const aliasValue = variables[aliasVariable];
      const stepValue = variables[`--t-accent-accent${step}`];

      if (aliasValue !== stepValue) {
        throw new Error(
          `${aliasVariable} (${mode}) is ${aliasValue}, expected step ${step} value ${stepValue}`,
        );
      }
    }
  }

  // Baseline surface semantics for this base (see adapter notes): panels use
  // the secondary background, elevated surfaces (modals) use the primary one.
  setToken(
    'surface.primary',
    light['--t-background-secondary'],
    dark['--t-background-secondary'],
  );
  setToken(
    'surface.secondary',
    light['--t-background-tertiary'],
    dark['--t-background-tertiary'],
  );
  setToken(
    'surface.elevated',
    light['--t-background-primary'],
    dark['--t-background-primary'],
  );

  // Twenty renders white text on the solid accent (step 9) in both modes.
  setToken('brand.onPrimary', '#ffffff', '#ffffff');

  setToken(
    'brand.primaryHover',
    light['--t-accent-accent10'],
    dark['--t-accent-accent10'],
  );
  setToken(
    'brand.primaryActive',
    light['--t-accent-accent11'],
    dark['--t-accent-accent11'],
  );

  setToken('status.info', light['--t-color-blue'], dark['--t-color-blue']);

  const sortedTokens = Object.fromEntries(
    Object.entries(tokens).sort(([pathA], [pathB]) => (pathA < pathB ? -1 : 1)),
  );

  return {
    name: 'preset.twenty-default',
    version: 1,
    sourceCommit: UPSTREAM_BASE_COMMIT,
    brand: { productName: 'Twenty', shortName: 'Twenty' },
    tokens: sortedTokens,
    assets: {},
  };
};

const isMainModule = process.argv[1]?.includes('generateTwentyDefaultPreset');

if (isMainModule) {
  const lightCssText = readFileSync(
    join(themeCssDirectory, 'theme-light.css'),
    'utf-8',
  );
  const darkCssText = readFileSync(
    join(themeCssDirectory, 'theme-dark.css'),
    'utf-8',
  );

  const preset = buildTwentyDefaultPreset(lightCssText, darkCssText);
  const outputPath = join(
    scriptDirectory,
    '../src/presets/twenty-default.preset.json',
  );

  writeFileSync(outputPath, `${JSON.stringify(preset, null, 2)}\n`);
  process.stdout.write(`wrote ${outputPath}\n`);
}
