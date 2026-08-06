import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import { O2D_DISTRIBUTION_BRANDING } from '@/o2d-branding/constants/O2dDistributionBranding';

// Runtime shape shared by the embedded artifact, the local cache and the
// published artifact served by GET /branding/current (doc 08 §6).
export type O2dBrandingRuntimeArtifact = {
  hash: string;
  css: { light: Record<string, string>; dark: Record<string, string> };
  brand: { productName: string; shortName: string };
};

export type O2dBrandingStatus = 'embedded' | 'cached' | 'fresh' | 'fallback';

export const getEmbeddedO2dBrandingArtifact =
  (): O2dBrandingRuntimeArtifact => ({
    hash: O2D_DISTRIBUTION_BRANDING.hash,
    css: O2D_DISTRIBUTION_BRANDING.css,
    brand: O2D_DISTRIBUTION_BRANDING.brand,
  });

export const o2dBrandingArtifactState =
  createAtomState<O2dBrandingRuntimeArtifact>({
    key: 'o2dBrandingArtifactState',
    defaultValue: getEmbeddedO2dBrandingArtifact(),
  });

export const o2dBrandingStatusState = createAtomState<O2dBrandingStatus>({
  key: 'o2dBrandingStatusState',
  defaultValue: 'embedded',
});
