import { useInsertionEffect } from 'react';

import { applyO2dBrandingStylesheet } from '@/o2d-branding/utils/applyO2dBrandingStylesheet';

type O2dBrandingProviderProps = {
  children: React.ReactNode;
};

// Global branding provider (doc 08 §2). Phase 2 scope: applies the embedded
// distribution artifact before the first browser paint (useInsertionEffect
// runs ahead of layout effects and style injection by the app). Workspace
// and domain resolution plug in here in phases 3/5 without changing the
// mounting contract (patch P1).
export const O2dBrandingProvider = ({ children }: O2dBrandingProviderProps) => {
  useInsertionEffect(() => {
    applyO2dBrandingStylesheet(document);
  }, []);

  return children;
};
