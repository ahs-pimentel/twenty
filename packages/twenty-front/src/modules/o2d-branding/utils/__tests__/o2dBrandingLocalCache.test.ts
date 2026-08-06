import {
  readO2dBrandingCache,
  writeO2dBrandingCache,
} from '@/o2d-branding/utils/o2dBrandingLocalCache';
import { type O2dBrandingRuntimeArtifact } from '@/o2d-branding/states/o2dBrandingArtifactState';

const buildArtifact = (): O2dBrandingRuntimeArtifact => ({
  hash: 'abc',
  css: { light: { '--t-color-blue': 'mock-light-value' }, dark: {} },
  brand: { productName: 'Cliente X', shortName: 'X' },
});

describe('o2dBrandingLocalCache', () => {
  it('round-trips an artifact through storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };

    writeO2dBrandingCache(storage, buildArtifact());

    expect(readO2dBrandingCache(storage)).toEqual(buildArtifact());
  });

  it('returns null for missing, corrupt or malformed entries', () => {
    expect(readO2dBrandingCache({ getItem: () => null })).toBeNull();
    expect(readO2dBrandingCache({ getItem: () => 'not-json{' })).toBeNull();
    expect(
      readO2dBrandingCache({ getItem: () => JSON.stringify({ hash: 1 }) }),
    ).toBeNull();
  });

  it('swallows storage write failures', () => {
    expect(() =>
      writeO2dBrandingCache(
        {
          setItem: () => {
            throw new Error('quota exceeded');
          },
        },
        buildArtifact(),
      ),
    ).not.toThrow();
  });
});
