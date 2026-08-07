import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';
import { O2dBrandingCacheService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-cache.service';
import { O2dBrandingDomainService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-domain.service';

describe('O2dBrandingDomainService', () => {
  let service: O2dBrandingDomainService;

  const entityManager = {
    findOneBy: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
  };
  const dataSource = {
    manager: entityManager,
    transaction: jest.fn(
      async (callback: (manager: typeof entityManager) => Promise<unknown>) =>
        callback(entityManager),
    ),
  };
  const cacheService = { invalidateHostArtifact: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    entityManager.findOneBy.mockResolvedValue(null);
    entityManager.save.mockImplementation(
      async (_entity: unknown, value: Record<string, unknown>) => ({
        id: 'dom-1',
        ...value,
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        O2dBrandingDomainService,
        O2dBrandingAuditService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: O2dBrandingCacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get(O2dBrandingDomainService);
  });

  it('creates an ACTIVE domain with a normalized hostname', async () => {
    const domain = await service.upsert('ws-1', 'user-1', {
      hostname: '  Cliente.CRM.Exemplo.COM ',
    });

    expect(domain.hostname).toBe('cliente.crm.exemplo.com');
    expect(domain.status).toBe('ACTIVE');
    expect(cacheService.invalidateHostArtifact).toHaveBeenCalledWith(
      'cliente.crm.exemplo.com',
    );
    expect(entityManager.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'branding.domain.upserted' }),
    );
  });

  it('rejects strings that are not hostnames', async () => {
    await expect(
      service.upsert('ws-1', 'user-1', { hostname: 'not a host!' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upsert('ws-1', 'user-1', { hostname: 'localhost' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a hostname already claimed by another workspace', async () => {
    entityManager.findOneBy.mockResolvedValue({
      id: 'dom-9',
      workspaceId: 'ws-other',
      hostname: 'cliente.crm.exemplo.com',
    });

    await expect(
      service.upsert('ws-1', 'user-1', {
        hostname: 'cliente.crm.exemplo.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses pinning a configuration from another workspace', async () => {
    entityManager.findOneBy.mockResolvedValue(null);

    await expect(
      service.upsert('ws-1', 'user-1', {
        hostname: 'cliente.crm.exemplo.com',
        configurationId: 'cfg-foreign',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a domain and invalidates its host cache', async () => {
    entityManager.findOneBy.mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-1',
      hostname: 'cliente.crm.exemplo.com',
    });

    await service.remove('ws-1', 'user-1', 'Cliente.CRM.Exemplo.com');

    expect(entityManager.delete).toHaveBeenCalledWith(expect.anything(), {
      id: 'dom-1',
    });
    expect(cacheService.invalidateHostArtifact).toHaveBeenCalledWith(
      'cliente.crm.exemplo.com',
    );
  });

  it('refuses removing a domain the workspace does not own', async () => {
    entityManager.findOneBy.mockResolvedValue(null);

    await expect(
      service.remove('ws-1', 'user-1', 'cliente.crm.exemplo.com'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
