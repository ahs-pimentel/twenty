import {
  type O2DAssetSlot,
  type O2DResolvedBranding,
  type ResolvedAssetMap,
} from 'o2d-branding-core';

export type O2dBrandingTokenChange = {
  tokenPath: string;
  mode: 'light' | 'dark';
  kind: 'added' | 'removed' | 'changed';
  from: string | number | null;
  to: string | number | null;
};

export type O2dBrandingAssetChange = {
  slot: string;
  kind: 'added' | 'removed' | 'changed';
  fromHash: string | null;
  toHash: string | null;
};

export type O2dBrandingVersionDiff = {
  tokenChanges: O2dBrandingTokenChange[];
  assetChanges: O2dBrandingAssetChange[];
};

// Automatic changelog diff (doc 15 §2): compares two immutable snapshots
// token by token per mode, plus the asset manifest by slot hash. Runs over
// resolved maps, so preset upgrades between versions surface as changes
// even when the admin never touched the token.
export const computeO2dBrandingVersionDiff = (
  fromSnapshot: O2DResolvedBranding,
  toSnapshot: O2DResolvedBranding,
): O2dBrandingVersionDiff => {
  const tokenChanges: O2dBrandingTokenChange[] = [];

  for (const mode of ['light', 'dark'] as const) {
    const fromTokens = fromSnapshot.tokens[mode] ?? {};
    const toTokens = toSnapshot.tokens[mode] ?? {};
    const tokenPaths = [
      ...new Set([...Object.keys(fromTokens), ...Object.keys(toTokens)]),
    ].sort();

    for (const tokenPath of tokenPaths) {
      const from = fromTokens[tokenPath];
      const to = toTokens[tokenPath];

      if (from === undefined) {
        tokenChanges.push({ tokenPath, mode, kind: 'added', from: null, to });
      } else if (to === undefined) {
        tokenChanges.push({ tokenPath, mode, kind: 'removed', from, to: null });
      } else if (from !== to) {
        tokenChanges.push({ tokenPath, mode, kind: 'changed', from, to });
      }
    }
  }

  return {
    tokenChanges,
    assetChanges: diffAssetManifests(fromSnapshot.assets, toSnapshot.assets),
  };
};

const diffAssetManifests = (
  fromManifest: ResolvedAssetMap,
  toManifest: ResolvedAssetMap,
): O2dBrandingAssetChange[] => {
  const assetChanges: O2dBrandingAssetChange[] = [];
  const slots = [
    ...new Set([...Object.keys(fromManifest), ...Object.keys(toManifest)]),
  ].sort() as O2DAssetSlot[];

  for (const slot of slots) {
    const from = fromManifest[slot];
    const to = toManifest[slot];

    if (from === undefined && to !== undefined) {
      assetChanges.push({
        slot,
        kind: 'added',
        fromHash: null,
        toHash: to.hash,
      });
    } else if (from !== undefined && to === undefined) {
      assetChanges.push({
        slot,
        kind: 'removed',
        fromHash: from.hash,
        toHash: null,
      });
    } else if (
      from !== undefined &&
      to !== undefined &&
      from.hash !== to.hash
    ) {
      assetChanges.push({
        slot,
        kind: 'changed',
        fromHash: from.hash,
        toHash: to.hash,
      });
    }
  }

  return assetChanges;
};
