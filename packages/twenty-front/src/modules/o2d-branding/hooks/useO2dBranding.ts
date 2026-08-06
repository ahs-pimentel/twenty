import { O2D_DISTRIBUTION_BRANDING } from '@/o2d-branding/constants/O2dDistributionBranding';
import { getO2dFaviconUrl } from '@/o2d-branding/utils/getO2dFaviconUrl';

export type O2dBrandingStatus = 'embedded' | 'cached' | 'fresh' | 'fallback';

type UseO2dBrandingResult = {
  productName: string;
  shortName: string;
  hash: string;
  status: O2dBrandingStatus;
  assets: { favicon?: string };
};

// Public hook for the few integrated components (logo, title, favicon —
// doc 08 §6). Phase 2 serves the embedded artifact only; published
// workspace configurations arrive with the server module (phase 3) and
// will move this to Jotai state without changing the return shape.
export const useO2dBranding = (): UseO2dBrandingResult => ({
  productName: O2D_DISTRIBUTION_BRANDING.brand.productName,
  shortName: O2D_DISTRIBUTION_BRANDING.brand.shortName,
  hash: O2D_DISTRIBUTION_BRANDING.hash,
  status: 'embedded',
  assets: { favicon: getO2dFaviconUrl() },
});
