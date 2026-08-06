import { fetchPublishedO2dBranding } from '@/o2d-branding/services/fetchPublishedO2dBranding';

const buildResponse = (status: number, body?: object): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

describe('fetchPublishedO2dBranding', () => {
  it('maps a 200 payload to a runtime artifact', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      buildResponse(200, {
        hash: 'abc',
        tokens: {
          cssLight: { '--t-color-blue': 'mock-light-value' },
          cssDark: { '--t-color-blue': 'mock-dark-value' },
        },
        brand: { productName: 'Cliente X', shortName: 'X' },
      }),
    );

    const result = await fetchPublishedO2dBranding(
      'https://server',
      'old-hash',
      fetchFn,
    );

    expect(fetchFn).toHaveBeenCalledWith('https://server/branding/current', {
      headers: { 'If-None-Match': 'old-hash' },
    });
    expect(result).toEqual({
      kind: 'fresh',
      artifact: {
        hash: 'abc',
        css: {
          light: { '--t-color-blue': 'mock-light-value' },
          dark: { '--t-color-blue': 'mock-dark-value' },
        },
        brand: { productName: 'Cliente X', shortName: 'X' },
        assets: {},
      },
    });
  });

  it('keeps well-formed asset entries and drops malformed ones', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      buildResponse(200, {
        hash: 'abc',
        tokens: { cssLight: {}, cssDark: {} },
        brand: { productName: 'Cliente X', shortName: 'X' },
        assets: {
          favicon: {
            url: '/branding/asset/asset-1/hash-1.svg',
            hash: 'hash-1',
            format: 'svg',
          },
          logoLight: { url: 42 },
        },
      }),
    );

    const result = await fetchPublishedO2dBranding(
      'https://server',
      'h',
      fetchFn,
    );

    expect(result).toMatchObject({
      kind: 'fresh',
      artifact: {
        assets: {
          favicon: {
            url: '/branding/asset/asset-1/hash-1.svg',
            hash: 'hash-1',
            format: 'svg',
          },
        },
      },
    });

    if (result.kind === 'fresh') {
      expect(result.artifact.assets).not.toHaveProperty('logoLight');
    }
  });

  it('returns not-modified on 304', async () => {
    const fetchFn = jest.fn().mockResolvedValue(buildResponse(304));

    await expect(
      fetchPublishedO2dBranding('https://server', 'same-hash', fetchFn),
    ).resolves.toEqual({ kind: 'not-modified' });
  });

  it('returns error on non-ok responses, malformed payloads and rejections', async () => {
    await expect(
      fetchPublishedO2dBranding(
        'https://server',
        'h',
        jest.fn().mockResolvedValue(buildResponse(500)),
      ),
    ).resolves.toEqual({ kind: 'error' });

    await expect(
      fetchPublishedO2dBranding(
        'https://server',
        'h',
        jest.fn().mockResolvedValue(buildResponse(200, { nope: true })),
      ),
    ).resolves.toEqual({ kind: 'error' });

    await expect(
      fetchPublishedO2dBranding(
        'https://server',
        'h',
        jest.fn().mockRejectedValue(new Error('network down')),
      ),
    ).resolves.toEqual({ kind: 'error' });
  });
});
