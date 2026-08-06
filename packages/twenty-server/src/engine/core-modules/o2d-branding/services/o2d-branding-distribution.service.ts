import { Injectable } from '@nestjs/common';

import {
  currentAdapter,
  normalizeBrandingConfig,
  ODOIS_PRESET,
} from 'o2d-branding-core';

export type O2dBrandingResolvedAsset = {
  url: string;
  hash: string;
  format: string;
};

export type O2dBrandingResolvedArtifact = {
  hash: string;
  cssLight: Record<string, string>;
  cssDark: Record<string, string>;
  assets: Record<string, O2dBrandingResolvedAsset>;
  brand: { productName: string; shortName: string };
  meta: {
    adapterVersion: string;
    source: 'workspace' | 'distribution';
    publishedAt: string | null;
  };
};

// Serves the distribution (preset.odois) artifact — the safe fallback for
// every resolution failure (docs 07/12). Computed once per process; the
// pipeline is deterministic, so the hash matches the build-time artifact
// embedded in the front.
@Injectable()
export class O2dBrandingDistributionService {
  private cachedArtifact: O2dBrandingResolvedArtifact | null = null;

  getDistributionArtifact(): O2dBrandingResolvedArtifact {
    if (this.cachedArtifact !== null) {
      return this.cachedArtifact;
    }

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
      throw new Error('distribution preset failed to normalize');
    }

    const overrides = currentAdapter.mapThemeTokens(resolved.tokens);

    this.cachedArtifact = {
      hash: resolved.meta.hash,
      cssLight: overrides.light,
      cssDark: overrides.dark,
      // Distribution-bundled binaries (default favicon/logo files) ship with
      // the front build itself — the artifact carries no uploaded assets.
      assets: {},
      brand: {
        productName: ODOIS_PRESET.brand.productName,
        shortName: ODOIS_PRESET.brand.shortName,
      },
      meta: {
        adapterVersion: currentAdapter.version,
        source: 'distribution',
        publishedAt: null,
      },
    };

    return this.cachedArtifact;
  }
}
