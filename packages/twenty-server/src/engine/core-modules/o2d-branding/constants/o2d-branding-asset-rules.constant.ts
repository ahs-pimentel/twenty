import { type O2DAssetSlot } from 'o2d-branding-core';

export type O2dBrandingAssetFormat = 'svg' | 'png' | 'webp' | 'ico';

// Ingestion rules per slot (docs/specs/branding-engine/11 §2): allowed
// formats mirror the slot table (AVIF deferred); byte ceilings are the
// spec's proposed distribution defaults — 2 MB for vector/icon containers,
// 5 MB for bitmaps. Dimension/ratio validation is a follow-up (needs an
// image decoder); rejection stays format+size+sanitization based for now.
export const O2D_BRANDING_ASSET_RULES: {
  maxBytesByFormat: Record<O2dBrandingAssetFormat, number>;
  slots: Record<O2DAssetSlot, { formats: readonly O2dBrandingAssetFormat[] }>;
} = {
  maxBytesByFormat: {
    svg: 2 * 1024 * 1024,
    ico: 2 * 1024 * 1024,
    png: 5 * 1024 * 1024,
    webp: 5 * 1024 * 1024,
  },
  slots: {
    favicon: { formats: ['ico', 'png', 'svg'] },
    logoLight: { formats: ['svg', 'png', 'webp'] },
    logoDark: { formats: ['svg', 'png', 'webp'] },
    loginBackground: { formats: ['png', 'webp'] },
    emailLogo: { formats: ['png'] },
    documentLogo: { formats: ['png', 'svg'] },
  },
};
