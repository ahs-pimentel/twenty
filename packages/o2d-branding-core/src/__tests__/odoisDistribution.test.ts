import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildOdoisPreset } from '../../scripts/generateOdoisPreset';
import {
  buildDistributionArtifact,
  buildIndexHtmlInlineBlock,
} from '../../scripts/generateDistributionArtifact';
import { ODOIS_PRESET } from '../presets/presetRegistry';
import { validateBrandingConfig } from '../validate/validateBrandingConfig';

const FRONT_DIRECTORY = join(__dirname, '../../../twenty-front');

// Phase 2 sync guards: preset.odois, the embedded distribution artifact and
// the index.html inline block are generated, never hand-edited. A failure
// here means a source changed (brand config, adapter, upstream CSS) — re-run
// the generation scripts.
describe('óDois distribution branding', () => {
  it('keeps the committed preset.odois in sync with its source config', () => {
    expect(ODOIS_PRESET).toEqual(buildOdoisPreset());
  });

  it('publishes a preset.odois that passes full validation', () => {
    const result = validateBrandingConfig({
      schemaVersion: 'o2d.branding.config/1-0-0',
      basePreset: 'preset.odois',
      brand: {
        productName: ODOIS_PRESET.brand.productName,
        shortName: ODOIS_PRESET.brand.shortName,
      },
      tokens: {},
      assets: {},
    });

    expect(
      result.issues.filter((issue) => issue.severity === 'error'),
    ).toEqual([]);
    expect(result.status).toBe('valid');
  });

  it('keeps the embedded front artifact in sync', () => {
    const committed = JSON.parse(
      readFileSync(
        join(
          FRONT_DIRECTORY,
          'src/modules/o2d-branding/generated/distributionBrandingArtifact.json',
        ),
        'utf-8',
      ),
    );

    expect(committed).toEqual(buildDistributionArtifact());
  });

  it('keeps the index.html inline block in sync (patch P2)', () => {
    const indexHtml = readFileSync(
      join(FRONT_DIRECTORY, 'index.html'),
      'utf-8',
    );

    expect(indexHtml).toContain(
      buildIndexHtmlInlineBlock(buildDistributionArtifact()),
    );
  });

  it('anchors the óDois brand color on step 9 in both modes', () => {
    const artifact = buildDistributionArtifact();

    expect(artifact.css.light['--t-color-blue9']).toBe(
      ODOIS_PRESET.tokens['brand.primary'].light,
    );
    expect(artifact.css.dark['--t-accent-accent9']).toBe(
      ODOIS_PRESET.tokens['brand.primary'].dark,
    );
  });
});
