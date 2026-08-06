import { useEffect, useInsertionEffect } from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { fetchPublishedO2dBranding } from '@/o2d-branding/services/fetchPublishedO2dBranding';
import {
  getEmbeddedO2dBrandingArtifact,
  o2dBrandingArtifactState,
  o2dBrandingStatusState,
} from '@/o2d-branding/states/o2dBrandingArtifactState';
import { applyO2dBrandingStylesheet } from '@/o2d-branding/utils/applyO2dBrandingStylesheet';
import {
  readO2dBrandingCache,
  writeO2dBrandingCache,
} from '@/o2d-branding/utils/o2dBrandingLocalCache';

type O2dBrandingProviderProps = {
  children: React.ReactNode;
};

// Global branding provider (doc 08). Load order: embedded distribution
// artifact (or the hash-versioned local cache when a newer publication was
// seen before) applied ahead of first paint, then background revalidation
// against GET /branding/current with If-None-Match. Any failure keeps the
// last good artifact — never a broken or wrong-brand theme.
export const O2dBrandingProvider = ({ children }: O2dBrandingProviderProps) => {
  const setO2dBrandingArtifact = useSetAtomState(o2dBrandingArtifactState);
  const setO2dBrandingStatus = useSetAtomState(o2dBrandingStatusState);

  useInsertionEffect(() => {
    const cached = readO2dBrandingCache(window.localStorage);
    const embedded = getEmbeddedO2dBrandingArtifact();

    if (cached !== null && cached.hash !== embedded.hash) {
      applyO2dBrandingStylesheet(document, cached);
      setO2dBrandingArtifact(cached);
      setO2dBrandingStatus('cached');
    } else {
      applyO2dBrandingStylesheet(document, embedded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const revalidate = async () => {
      const cached = readO2dBrandingCache(window.localStorage);
      const currentHash = cached?.hash ?? getEmbeddedO2dBrandingArtifact().hash;

      const result = await fetchPublishedO2dBranding(
        REACT_APP_SERVER_BASE_URL,
        currentHash,
      );

      if (result.kind === 'fresh') {
        applyO2dBrandingStylesheet(document, result.artifact);
        writeO2dBrandingCache(window.localStorage, result.artifact);
        setO2dBrandingArtifact(result.artifact);
        setO2dBrandingStatus('fresh');
      } else if (result.kind === 'not-modified') {
        setO2dBrandingStatus('fresh');
      } else {
        setO2dBrandingStatus('fallback');
      }
    };

    void revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return children;
};
