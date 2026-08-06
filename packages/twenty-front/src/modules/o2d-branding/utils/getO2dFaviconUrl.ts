import { type O2dBrandingRuntimeArtifact } from '@/o2d-branding/states/o2dBrandingArtifactState';

// Published favicon asset (doc 11): the artifact carries a relative
// content-addressed URL served by the branding public controller —
// undefined keeps every consumer on its current fallback.
export const getO2dFaviconUrl = (
  serverBaseUrl: string,
  artifact?: O2dBrandingRuntimeArtifact,
): string | undefined => {
  const faviconAsset = artifact?.assets?.favicon;

  if (faviconAsset === undefined) {
    return undefined;
  }

  return `${serverBaseUrl}${faviconAsset.url}`;
};
