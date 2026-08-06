import { getO2dFaviconUrl } from '@/o2d-branding/utils/getO2dFaviconUrl';

describe('getO2dFaviconUrl', () => {
  it('builds an absolute url from the artifact favicon asset', () => {
    expect(
      getO2dFaviconUrl('https://server', {
        hash: 'abc',
        css: { light: {}, dark: {} },
        brand: { productName: 'Cliente X', shortName: 'X' },
        assets: {
          favicon: {
            url: '/branding/asset/asset-1/hash-1.svg',
            hash: 'hash-1',
            format: 'svg',
          },
        },
      }),
    ).toBe('https://server/branding/asset/asset-1/hash-1.svg');
  });

  it('returns undefined without an artifact or favicon asset', () => {
    expect(getO2dFaviconUrl('https://server')).toBeUndefined();
    expect(
      getO2dFaviconUrl('https://server', {
        hash: 'abc',
        css: { light: {}, dark: {} },
        brand: { productName: 'Cliente X', shortName: 'X' },
      }),
    ).toBeUndefined();
  });
});
