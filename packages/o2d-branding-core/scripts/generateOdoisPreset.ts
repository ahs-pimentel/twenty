import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { UPSTREAM_BASE_COMMIT } from '../src/adapters/adapterConstants';
import { normalizeBrandingConfig } from '../src/normalize/normalizeBrandingConfig';
import { validateBrandingConfig } from '../src/validate/validateBrandingConfig';
import {
  type O2DBrandingConfig,
  type O2DBrandingPreset,
} from '../src/types/branding.types';

// Generates preset.odois by running the óDois identity through the engine's
// own pipeline (scale generation + derivation + validation) on top of
// preset.twenty-default. Never hand-edit the emitted JSON — change the
// source config below and re-run:
//   npx tsx scripts/generateOdoisPreset.ts

// PROVISIONAL identity: brand color and naming pending óDois brand approval
// (JUR-4, doc 27). Swapping the hex below regenerates the whole preset and
// distribution artifact deterministically.
export const ODOIS_SOURCE_CONFIG: O2DBrandingConfig = {
  schemaVersion: 'o2d.branding.config/1-0-0',
  basePreset: 'preset.twenty-default',
  brand: {
    productName: 'óDois CRM',
    shortName: 'óDois',
    description: 'CRM da óDois baseado na distribuição controlada do Twenty',
  },
  tokens: {
    'brand.primary': '#7c3aed',
  },
  assets: {},
};

export const buildOdoisPreset = (): O2DBrandingPreset => {
  const validation = validateBrandingConfig(ODOIS_SOURCE_CONFIG);

  if (validation.status !== 'valid') {
    throw new Error(
      `preset.odois source config failed validation: ${JSON.stringify(
        validation.issues.filter((issue) => issue.severity === 'error'),
        null,
        2,
      )}`,
    );
  }

  const { resolved } = normalizeBrandingConfig(ODOIS_SOURCE_CONFIG);

  if (resolved === null) {
    throw new Error('normalization of the óDois source config failed');
  }

  const tokens: O2DBrandingPreset['tokens'] = {};

  for (const path of Object.keys(resolved.tokens.light).sort()) {
    tokens[path] = {
      light: resolved.tokens.light[path],
      dark: resolved.tokens.dark[path],
    };
  }

  return {
    name: 'preset.odois',
    version: 1,
    sourceCommit: UPSTREAM_BASE_COMMIT,
    brand: {
      productName: ODOIS_SOURCE_CONFIG.brand.productName,
      shortName: ODOIS_SOURCE_CONFIG.brand.shortName,
    },
    tokens,
    assets: {},
  };
};

const isMainModule = process.argv[1]?.includes('generateOdoisPreset');

if (isMainModule) {
  const outputPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../src/presets/odois.preset.json',
  );

  writeFileSync(outputPath, `${JSON.stringify(buildOdoisPreset(), null, 2)}\n`);
  process.stdout.write(`wrote ${outputPath}\n`);
}
