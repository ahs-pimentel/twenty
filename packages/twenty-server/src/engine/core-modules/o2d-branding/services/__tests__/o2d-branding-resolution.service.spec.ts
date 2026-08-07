import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { O2dBrandingAssetEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-asset.entity';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingDomainEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-domain.entity';
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
  const domainRepository = { findOne: jest.fn() };
  const workspaceRepository = { findOneBy: jest.fn() };
  const workspaceDomainsService = {
    getWorkspaceByOriginOrDefaultWorkspace: jest.fn(),
  };
  const cacheService = {
    getPublishedArtifact: jest.fn(),
    setPublishedArtifact: jest.fn(),
    invalidatePublishedArtifact: jest.fn(),
    getHostArtifact: jest.fn(),
    setHostArtifact: jest.fn(),
    invalidateHostArtifact: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    assetRepository.findBy.mockResolvedValue([]);
    cacheService.getPublishedArtifact.mockResolvedValue(undefined);
    cacheService.getHostArtifact.mockResolvedValue(undefined);
    domainRepository.findOne.mockResolvedValue(null);
    workspaceRepository.findOneBy.mockResolvedValue(null);
    workspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace.mockResolvedValue(
      undefined,
    );

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
        {
          provide: getRepositoryToken(O2dBrandingDomainEntity),
          useValue: domainRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: workspaceRepository,
        },
        {
          provide: WorkspaceDomainsService,
          useValue: workspaceDomainsService,
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

  describe('resolveByHostname', () => {
    const publishedVersion = {
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
    };

    it('serves a host cache hit without touching the database', async () => {
      const cachedArtifact = {
        hash: 'cached',
        cssLight: {},
        cssDark: {},
        assets: {},
        brand: { productName: 'Cliente X', shortName: 'X' },
        meta: {
          adapterVersion: 'o2d-adapter/538b1808@1',
          source: 'workspace' as const,
          publishedAt: null,
        },
      };

      cacheService.getHostArtifact.mockResolvedValue(cachedArtifact);

      const artifact = await service.resolveByHostname('Cliente.Crm.Exemplo');

      expect(artifact).toBe(cachedArtifact);
      expect(cacheService.getHostArtifact).toHaveBeenCalledWith(
        'cliente.crm.exemplo',
      );
      expect(domainRepository.findOne).not.toHaveBeenCalled();
    });

    it('resolves a branding domain to its pinned configuration', async () => {
      domainRepository.findOne.mockResolvedValue({
        id: 'dom-1',
        workspaceId: 'ws-1',
        hostname: 'cliente.crm.exemplo',
        configurationId: 'cfg-domain',
      });
      workspaceRepository.findOneBy.mockResolvedValue({
        id: 'ws-1',
        activationStatus: 'ACTIVE',
      });
      configurationRepository.findOne.mockResolvedValue({
        id: 'cfg-domain',
        workspaceId: 'ws-1',
        publishedVersionId: 'v-2',
      });
      versionRepository.findOneBy.mockResolvedValue(publishedVersion);

      const artifact = await service.resolveByHostname('cliente.crm.exemplo');

      expect(artifact.meta.source).toBe('workspace');
      expect(artifact.hash).toBe('abc123');
      expect(cacheService.setHostArtifact).toHaveBeenCalledWith(
        'cliente.crm.exemplo',
        artifact,
      );
    });

    it('serves the distribution identity for a suspended workspace', async () => {
      domainRepository.findOne.mockResolvedValue({
        id: 'dom-1',
        workspaceId: 'ws-1',
        hostname: 'cliente.crm.exemplo',
        configurationId: null,
      });
      workspaceRepository.findOneBy.mockResolvedValue({
        id: 'ws-1',
        activationStatus: 'SUSPENDED',
      });

      const artifact = await service.resolveByHostname('cliente.crm.exemplo');

      expect(artifact.meta.source).toBe('distribution');
      expect(cacheService.setHostArtifact).not.toHaveBeenCalled();
    });

    it('falls back to workspace-by-origin resolution without a branding domain', async () => {
      workspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace.mockResolvedValue(
        { id: 'ws-1', activationStatus: 'ACTIVE' },
      );
      configurationRepository.findOne.mockResolvedValue({
        id: 'cfg-1',
        publishedVersionId: 'v-2',
      });
      versionRepository.findOneBy.mockResolvedValue(publishedVersion);

      const artifact = await service.resolveByHostname('acme.exemplo.com');

      expect(
        workspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace,
      ).toHaveBeenCalledWith('https://acme.exemplo.com');
      expect(artifact.meta.source).toBe('workspace');
    });

    it('serves the distribution identity for an unknown host', async () => {
      const artifact = await service.resolveByHostname('desconhecido.tld');

      expect(artifact.meta.source).toBe('distribution');
      expect(cacheService.setHostArtifact).not.toHaveBeenCalled();
    });
  });
});
