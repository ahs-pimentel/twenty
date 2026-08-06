import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { currentAdapter } from '../src/adapters/currentAdapter';
import { normalizeBrandingConfig } from '../src/normalize/normalizeBrandingConfig';
import { ODOIS_PRESET } from '../src/presets/presetRegistry';
import { type CssVariableBlock } from '../src/types/branding.types';

// Builds the distribution branding artifact embedded in the front build
// (D4, doc 05): pre-compiled CSS variable blocks + metadata, plus the
// critical inline block delimited inside index.html (P2, doc 22). Run:
//   npx tsx scripts/generateDistributionArtifact.ts

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontDirectory = join(scriptDirectory, '../../twenty-front');

// First-paint tokens only — the full artifact takes over on provider mount.
const CRITICAL_VARIABLES = [
  '--t-background-primary',
  '--t-background-secondary',
  '--t-background-tertiary',
  '--t-font-color-primary',
  '--t-font-color-secondary',
  '--t-color-blue',
  '--t-accent-primary',
];

export type O2DDistributionArtifact = {
  artifactVersion: 'o2d.branding.artifact/1-0-0';
  hash: string;
  adapter: string;
  basePreset: string;
  brand: { productName: string; shortName: string };
  css: { light: CssVariableBlock; dark: CssVariableBlock };
};

export const buildDistributionArtifact = (): O2DDistributionArtifact => {
  const { resolved } = normalizeBrandingConfig({
    schemaVersion: 'o2d.branding.config/1-0-0',
    basePreset: 'preset.odois',
    brand: {
      productName: ODOIS_PRESET.brand.productName,
      shortName: ODOIS_PRESET.brand.shortName,
    },
    tokens: {},
    assets: {},
  });

  if (resolved === null) {
    throw new Error('normalization of preset.odois failed');
  }

  const css = currentAdapter.mapThemeTokens(resolved.tokens);

  return {
    artifactVersion: 'o2d.branding.artifact/1-0-0',
    hash: resolved.meta.hash,
    adapter: currentAdapter.version,
    basePreset: 'preset.odois',
    brand: {
      productName: ODOIS_PRESET.brand.productName,
      shortName: ODOIS_PRESET.brand.shortName,
    },
    css,
  };
};

const cssRule = (selector: string, block: CssVariableBlock): string => {
  const declarations = Object.entries(block)
    .map(([variable, value]) => `${variable}: ${value};`)
    .join(' ');

  return `${selector} { ${declarations} }`;
};

const pickCritical = (block: CssVariableBlock): CssVariableBlock =>
  Object.fromEntries(
    CRITICAL_VARIABLES.filter((variable) => block[variable] !== undefined).map(
      (variable) => [variable, block[variable]],
    ),
  );

// The inline block also overrides the pre-hydration body background vars the
// upstream keeps in index.html, so the very first paint is on-brand.
export const buildIndexHtmlInlineBlock = (
  artifact: O2DDistributionArtifact,
): string =>
  [
    `    <style id="o2d-branding-inline" data-hash="${artifact.hash}">`,
    `      ${cssRule('html.light', pickCritical(artifact.css.light))}`,
    `      ${cssRule('html.dark', pickCritical(artifact.css.dark))}`,
    `      :root { --theme-light-background-tertiary: ${artifact.css.light['--t-background-tertiary']}; --theme-dark-background-tertiary: ${artifact.css.dark['--t-background-tertiary']}; }`,
    '    </style>',
    `    <script id="o2d-branding-identity">`,
    `      document.title = ${JSON.stringify(artifact.brand.productName)};`,
    '    </script>',
  ].join('\n');

const isMainModule = process.argv[1]?.includes('generateDistributionArtifact');

if (isMainModule) {
  const artifact = buildDistributionArtifact();

  const artifactPath = join(
    frontDirectory,
    'src/modules/o2d-branding/generated/distributionBrandingArtifact.json',
  );

  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`wrote ${artifactPath}\n`);

  const indexHtmlPath = join(frontDirectory, 'index.html');
  const indexHtml = readFileSync(indexHtmlPath, 'utf-8');
  const blockPattern =
    /(<!-- BEGIN: O2D Branding -->)[\s\S]*?(<!-- END: O2D Branding -->)/;

  if (!blockPattern.test(indexHtml)) {
    throw new Error(
      'index.html is missing the O2D Branding delimiters (patch P2)',
    );
  }

  writeFileSync(
    indexHtmlPath,
    indexHtml.replace(
      blockPattern,
      `$1\n${buildIndexHtmlInlineBlock(artifact)}\n    $2`,
    ),
  );
  process.stdout.write(`updated O2D block in ${indexHtmlPath}\n`);
}
