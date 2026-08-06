import { O2D_DISTRIBUTION_BRANDING } from '@/o2d-branding/constants/O2dDistributionBranding';

// The distribution brand color (scale step 9) — single source of truth for
// placeholders and previews, never hardcoded in components.
export const getO2dDefaultBrandColor = (): string =>
  O2D_DISTRIBUTION_BRANDING.css.light['--t-color-blue9'];
