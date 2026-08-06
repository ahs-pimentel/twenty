import { Test, type TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { UnprocessableEntityException } from '@nestjs/common';

import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import { O2dBrandingVersionStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';
import { O2dBrandingCacheService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-cache.service';
import { O2dBrandingPublicationService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-publication.service';

const buildValidDraft = () => ({
  schemaVersion: 'o2d.branding.config/1-0-0' as const,
  basePreset: 'preset.odois',
  brand: { productName: 'Cliente X', shortName: 'X' },
  tokens: {},
  assets: {},
});

describe('O2dBrandingPublicationService', () => {
  let service: O2dBrandingPublicationService;

  const entityManager = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
  };

  const dataSource = {
    manager: entityManager,
    transaction: jest.fn(
      async (callback: (manager: typeof entityManager) => Promise<unknown>) =>
        callback(entityManager),
    ),
  };

  const cacheService = { invalidatePublishedArtifact: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        O2dBrandingPublicationService,
        O2dBrandingAuditService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: O2dBrandingCacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get(O2dBrandingPublicationService);
  });

  it('publishes a valid draft as an immutable PUBLISHED version', async () => {
    const configuration = {
      id: 'cfg-1',
      workspaceId: 'ws-1',
      publishedVersionId: null,
      draftConfig: buildValidDraft(),
    };

    entityManager.findOneBy.mockImplementation(
      async (_entity: unknown, where: Record<string, unknown>) =>
        'id' in where && where.id === 'cfg-1' ? configuration : null,
    );
    // No previous version for this configuration.
    entityManager.findOne.mockResolvedValue(null);
    entityManager.save.mockImplementation(
      async (_entity: unknown, value: Record<string, unknown>) => ({
        id: 'v-1',
        ...value,
      }),
    );

    const version = (await service.publish(
      'ws-1',
      'user-1',
      'cfg-1',
      'first publish',
    )) as O2dBrandingVersionEntity;

    expect(version.number).toBe(1);
    expect(version.status).toBe(O2dBrandingVersionStatus.PUBLISHED);
    expect(version.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(version.artifact?.cssLight['--t-color-blue9']).toBe('#7c3aed');
    // Redis invalidation happens after the transaction commits (doc 07 §5).
    expect(cacheService.invalidatePublishedArtifact).toHaveBeenCalledWith(
      'ws-1',
    );

    // Pointer swap + audit happen inside the same transaction.
    expect(entityManager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'cfg-1' },
      { publishedVersionId: 'v-1' },
    );
    expect(entityManager.insert).toHaveBeenCalledTimes(2); // publication + audit
  });

  it('blocks publication when the draft fails validation', async () => {
    const configuration = {
      id: 'cfg-1',
      workspaceId: 'ws-1',
      publishedVersionId: null,
      draftConfig: {
        ...buildValidDraft(),
        tokens: { 'text.primary': 'not-a-color' },
      },
    };

    entityManager.findOneBy.mockResolvedValue(configuration);

    await expect(
      service.publish('ws-1', 'user-1', 'cfg-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    // Failure is recorded (publication row + audit) but no version is saved.
    expect(entityManager.save).not.toHaveBeenCalled();
    expect(entityManager.insert).toHaveBeenCalled();
  });

  it('rolls back by creating a new version based on the restored one', async () => {
    const configuration = {
      id: 'cfg-1',
      workspaceId: 'ws-1',
      publishedVersionId: 'v-7',
      draftConfig: buildValidDraft(),
    };
    const targetVersion = {
      id: 'v-5',
      configurationId: 'cfg-1',
      number: 5,
      adapterVersion: 'o2d-adapter/538b1808@1',
      snapshot: { tokens: {}, assets: {}, meta: {} },
      assetManifest: {},
      artifact: { cssLight: {}, cssDark: {}, meta: {} },
      schemaVersion: 'o2d.branding.config/1-0-0',
      twentyVersion: { baseCommit: 'abc' },
      hash: 'deadbeef',
      validationResult: null,
    };
    const currentPublished = { id: 'v-7', number: 7 };

    entityManager.findOneBy.mockImplementation(
      async (_entity: unknown, where: Record<string, unknown>) => {
        if (where.id === 'cfg-1') {
          return configuration;
        }
        if (where.number === 5) {
          return targetVersion;
        }
        if (where.id === 'v-7') {
          return currentPublished;
        }

        return null;
      },
    );
    entityManager.findOne.mockResolvedValue({ number: 7 });
    entityManager.save.mockImplementation(
      async (_entity: unknown, value: Record<string, unknown>) => ({
        id: 'v-8',
        ...value,
      }),
    );

    const newVersion = (await service.rollback(
      'ws-1',
      'user-1',
      'cfg-1',
      5,
      'broken contrast in production',
    )) as O2dBrandingVersionEntity;

    expect(newVersion.number).toBe(8);
    expect(newVersion.basedOnVersionId).toBe('v-5');
    expect(newVersion.hash).toBe('deadbeef');
    expect(entityManager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'v-7' },
      { status: O2dBrandingVersionStatus.ROLLED_BACK },
    );
  });

  it('blocks rollback to a version generated by another adapter', async () => {
    entityManager.findOneBy.mockImplementation(
      async (_entity: unknown, where: Record<string, unknown>) => {
        if (where.id === 'cfg-1') {
          return { id: 'cfg-1', workspaceId: 'ws-1', publishedVersionId: null };
        }
        if (where.number === 3) {
          return { id: 'v-3', number: 3, adapterVersion: 'o2d-adapter/old@1' };
        }

        return null;
      },
    );

    await expect(
      service.rollback('ws-1', 'user-1', 'cfg-1', 3, 'reason'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
