import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { O2dBrandingAssetEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-asset.entity';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import { O2dBrandingAssetStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingCacheService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-cache.service';
import { O2dBrandingDistributionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';
import { O2dBrandingResolutionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-resolution.service';

describe('O2dBrandingResolutionService', () => {
  let service: O2dBrandingResolutionService;
  const configurationRepository = { findOne: jest.fn() };
  const versionRepository = { findOneBy: jest.fn() };
  const assetRepository = { findBy: jest.fn().mockResolvedValue([]) };
  const cacheService = {
    getPublishedArtifact: jest.fn(),
    setPublishedArtifact: jest.fn(),
    invalidatePublishedArtifact: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    assetRepository.findBy.mockResolvedValue([]);
    cacheService.getPublishedArtifact.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        O2dBrandingResolutionService,
        O2dBrandingDistributionService,
        {
          provide: getRepositoryToken(O2dBrandingConfigurationEntity),
          useValue: configurationRepository,
        },
        {
          provide: getRepositoryToken(O2dBrandingVersionEntity),
          useValue: versionRepository,
        },
        {
          provide: getRepositoryToken(O2dBrandingAssetEntity),
          useValue: assetRepository,
        },
        { provide: O2dBrandingCacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get(O2dBrandingResolutionService);
  });

  it('falls back to the distribution artifact when nothing is published', async () => {
    configurationRepository.findOne.mockResolvedValue(null);

    const artifact = await service.resolveByWorkspace('ws-1');

    expect(artifact.meta.source).toBe('distribution');
    expect(artifact.brand.productName).toBe('óDois CRM');
  });

  it('serves the published workspace artifact when available', async () => {
    configurationRepository.findOne.mockResolvedValue({
      id: 'cfg-1',
      publishedVersionId: 'v-2',
    });
    versionRepository.findOneBy.mockResolvedValue({
      id: 'v-2',
      hash: 'abc123',
      adapterVersion: 'o2d-adapter/538b1808@1',
      createdAt: new Date('2026-08-06T00:00:00Z'),
      artifact: {
        cssLight: { '--t-color-blue': '#123456' },
        cssDark: { '--t-color-blue': '#123456' },
        meta: {
          adapterVersion: 'o2d-adapter/538b1808@1',
          hash: 'abc123',
          productName: 'Cliente X',
          shortName: 'X',
        },
      },
    });

    const artifact = await service.resolveByWorkspace('ws-1');

    expect(artifact.meta.source).toBe('workspace');
    expect(artifact.hash).toBe('abc123');
    expect(artifact.brand.productName).toBe('Cliente X');
    expect(artifact.cssLight['--t-color-blue']).toBe('#123456');
  });

  it('resolves manifest asset references to public urls, dropping stale ones', async () => {
    configurationRepository.findOne.mockResolvedValue({
      id: 'cfg-1',
      publishedVersionId: 'v-2',
    });
    versionRepository.findOneBy.mockResolvedValue({
      id: 'v-2',
      hash: 'abc123',
      adapterVersion: 'o2d-adapter/538b1808@1',
      createdAt: new Date('2026-08-06T00:00:00Z'),
      assetManifest: {
        favicon: { assetId: 'asset-1', hash: 'hash-1' },
        logoLight: { assetId: 'asset-2', hash: 'stale-hash' },
      },
      artifact: {
        cssLight: {},
        cssDark: {},
        meta: {
          adapterVersion: 'o2d-adapter/538b1808@1',
          hash: 'abc123',
          productName: 'Cliente X',
          shortName: 'X',
        },
      },
    });
    assetRepository.findBy.mockResolvedValue([
      {
        id: 'asset-1',
        hash: 'hash-1',
        format: 'svg',
        url: '/branding/asset/asset-1/hash-1.svg',
        status: O2dBrandingAssetStatus.VALID,
      },
      {
        id: 'asset-2',
        hash: 'current-hash',
        format: 'png',
        url: '/branding/asset/asset-2/current-hash.png',
        status: O2dBrandingAssetStatus.VALID,
      },
    ]);

    const artifact = await service.resolveByWorkspace('ws-1');

    expect(artifact.assets).toEqual({
      favicon: {
        url: '/branding/asset/asset-1/hash-1.svg',
        hash: 'hash-1',
        format: 'svg',
      },
    });
  });

  it('degrades to the distribution artifact on repository errors', async () => {
    configurationRepository.findOne.mockRejectedValue(new Error('db down'));

    const artifact = await service.resolveByWorkspace('ws-1');

    expect(artifact.meta.source).toBe('distribution');
  });

  it('serves a cache hit without touching the database', async () => {
    const cachedArtifact = {
      hash: 'cached-hash',
      cssLight: {},
      cssDark: {},
      assets: {},
      brand: { productName: 'Cliente X', shortName: 'X' },
      meta: {
        adapterVersion: 'o2d-adapter/538b1808@1',
        source: 'workspace' as const,
        publishedAt: '2026-08-06T00:00:00Z',
      },
    };

    cacheService.getPublishedArtifact.mockResolvedValue(cachedArtifact);

    const artifact = await service.resolveByWorkspace('ws-1');

    expect(artifact).toBe(cachedArtifact);
    expect(configurationRepository.findOne).not.toHaveBeenCalled();
  });

  it('populates the cache for workspace artifacts but never for fallbacks', async () => {
    configurationRepository.findOne.mockResolvedValue(null);

    await service.resolveByWorkspace('ws-1');

    expect(cacheService.setPublishedArtifact).not.toHaveBeenCalled();

    configurationRepository.findOne.mockResolvedValue({
      id: 'cfg-1',
      publishedVersionId: 'v-2',
    });
    versionRepository.findOneBy.mockResolvedValue({
      id: 'v-2',
      hash: 'abc123',
      adapterVersion: 'o2d-adapter/538b1808@1',
      createdAt: new Date('2026-08-06T00:00:00Z'),
      artifact: {
        cssLight: {},
        cssDark: {},
        meta: {
          adapterVersion: 'o2d-adapter/538b1808@1',
          hash: 'abc123',
          productName: 'Cliente X',
          shortName: 'X',
        },
      },
    });

    const artifact = await service.resolveByWorkspace('ws-1');

    expect(cacheService.setPublishedArtifact).toHaveBeenCalledWith(
      'ws-1',
      artifact,
    );
  });
});
