import { type O2dBrandingRuntimeArtifact } from '@/o2d-branding/states/o2dBrandingArtifactState';

type PublishedBrandingResponse = {
  hash: string;
  tokens: { cssLight: Record<string, string>; cssDark: Record<string, string> };
  brand: { productName: string; shortName: string };
};

export type FetchPublishedO2dBrandingResult =
  | { kind: 'fresh'; artifact: O2dBrandingRuntimeArtifact }
  | { kind: 'not-modified' }
  | { kind: 'error' };

// Revalidates the published branding against GET /branding/current using the
// ETag/If-None-Match contract (docs 08 §3, 19). Injected fetch keeps the
// function unit-testable.
export const fetchPublishedO2dBranding = async (
  serverBaseUrl: string,
  currentHash: string,
  fetchFn: typeof fetch = fetch,
): Promise<FetchPublishedO2dBrandingResult> => {
  try {
    const response = await fetchFn(`${serverBaseUrl}/branding/current`, {
      headers: { 'If-None-Match': currentHash },
    });

    if (response.status === 304) {
      return { kind: 'not-modified' };
    }

    if (!response.ok) {
      return { kind: 'error' };
    }

    const payload = (await response.json()) as PublishedBrandingResponse;

    if (
      typeof payload?.hash !== 'string' ||
      typeof payload?.tokens?.cssLight !== 'object' ||
      typeof payload?.tokens?.cssDark !== 'object'
    ) {
      return { kind: 'error' };
    }

    return {
      kind: 'fresh',
      artifact: {
        hash: payload.hash,
        css: { light: payload.tokens.cssLight, dark: payload.tokens.cssDark },
        brand: {
          productName: payload.brand?.productName ?? '',
          shortName: payload.brand?.shortName ?? '',
        },
      },
    };
  } catch {
    return { kind: 'error' };
  }
};
