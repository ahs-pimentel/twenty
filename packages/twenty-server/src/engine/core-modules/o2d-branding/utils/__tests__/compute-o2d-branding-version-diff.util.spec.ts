import { type O2DResolvedBranding } from 'o2d-branding-core';

import { computeO2dBrandingVersionDiff } from 'src/engine/core-modules/o2d-branding/utils/compute-o2d-branding-version-diff.util';

const buildSnapshot = (
  tokens: { light: Record<string, string>; dark: Record<string, string> },
  assets: Record<string, { assetId: string; hash: string }> = {},
): O2DResolvedBranding => ({
  tokens,
  assets,
  meta: {
    hash: 'hash',
    schemaVersion: 'o2d.branding.config/1-0-0',
    basePreset: 'preset.odois',
  },
});

describe('computeO2dBrandingVersionDiff', () => {
  it('reports added, removed and changed tokens per mode', () => {
    const fromSnapshot = buildSnapshot({
      light: { 'brand.primary': '#111111', 'text.primary': '#000000' },
      dark: { 'brand.primary': '#111111' },
    });
    const toSnapshot = buildSnapshot({
      light: { 'brand.primary': '#222222', 'surface.base': '#ffffff' },
      dark: { 'brand.primary': '#111111' },
    });

    const diff = computeO2dBrandingVersionDiff(fromSnapshot, toSnapshot);

    expect(diff.tokenChanges).toEqual([
      {
        tokenPath: 'brand.primary',
        mode: 'light',
        kind: 'changed',
        from: '#111111',
        to: '#222222',
      },
      {
        tokenPath: 'surface.base',
        mode: 'light',
        kind: 'added',
        from: null,
        to: '#ffffff',
      },
      {
        tokenPath: 'text.primary',
        mode: 'light',
        kind: 'removed',
        from: '#000000',
        to: null,
      },
    ]);
  });

  it('returns an empty diff for identical snapshots', () => {
    const snapshot = buildSnapshot({
      light: { 'brand.primary': '#111111' },
      dark: { 'brand.primary': '#111111' },
    });

    const diff = computeO2dBrandingVersionDiff(snapshot, snapshot);

    expect(diff.tokenChanges).toEqual([]);
    expect(diff.assetChanges).toEqual([]);
  });

  it('diffs the asset manifest by slot hash', () => {
    const fromSnapshot = buildSnapshot(
      { light: {}, dark: {} },
      {
        favicon: { assetId: 'a-1', hash: 'aaaa' },
        logoLight: { assetId: 'a-2', hash: 'bbbb' },
      },
    );
    const toSnapshot = buildSnapshot(
      { light: {}, dark: {} },
      {
        favicon: { assetId: 'a-3', hash: 'cccc' },
        logoDark: { assetId: 'a-4', hash: 'dddd' },
      },
    );

    const diff = computeO2dBrandingVersionDiff(fromSnapshot, toSnapshot);

    expect(diff.assetChanges).toEqual([
      { slot: 'favicon', kind: 'changed', fromHash: 'aaaa', toHash: 'cccc' },
      { slot: 'logoDark', kind: 'added', fromHash: null, toHash: 'dddd' },
      { slot: 'logoLight', kind: 'removed', fromHash: 'bbbb', toHash: null },
    ]);
  });
});
