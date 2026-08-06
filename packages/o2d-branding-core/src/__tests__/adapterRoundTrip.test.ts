import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildDefaultConfig, readInstalledThemeCss } from './testHelpers';
import { currentAdapter } from '../adapters/currentAdapter';
import { normalizeBrandingConfig } from '../normalize/normalizeBrandingConfig';

// Phase 1 acceptance criterion (doc 26): applying preset.twenty-default
// through the adapter must be a no-op against the stock Twenty theme —
// every emitted CSS variable carries exactly the value already present in
// the installed stylesheets.
describe('neutral round-trip (preset.twenty-default via adapter)', () => {
  const installed = readInstalledThemeCss();
  const { resolved } = normalizeBrandingConfig(buildDefaultConfig());

  if (resolved === null) {
    throw new Error('normalization of the default preset must succeed');
  }

  const overrides = currentAdapter.mapThemeTokens(resolved.tokens);

  it.each(['light', 'dark'] as const)(
    'emits only values identical to the installed %s theme',
    (mode) => {
      const emitted = Object.entries(overrides[mode]);

      expect(emitted.length).toBeGreaterThan(60);

      const mismatches = emitted.filter(
        ([variable, value]) => installed[mode][variable] !== value,
      );

      expect(mismatches).toEqual([]);
    },
  );

  it('reports the adapter as non-blocking against the installed CSS', () => {
    const compatibility = currentAdapter.validateCompatibility({
      light: new Set(Object.keys(installed.light)),
      dark: new Set(Object.keys(installed.dark)),
    });

    expect(compatibility.status).not.toBe('incompatible');
    expect(
      compatibility.issues.filter((issue) => issue.severity === 'blocking'),
    ).toEqual([]);
  });

  it('declares global points that exist in the installed front', () => {
    const globalPoints = currentAdapter.mapGlobalPoints();
    const indexHtml = readFileSync(
      join(__dirname, '../../../twenty-front/index.html'),
      'utf-8',
    );

    for (const point of Object.values(globalPoints)) {
      expect(point.file).toBe('packages/twenty-front/index.html');
      expect(indexHtml).toContain(point.expected);
    }
  });
});
