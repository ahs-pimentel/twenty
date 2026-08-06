import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

import { FileFolder } from 'twenty-shared/types';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { O2dBrandingAssetStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingAssetService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-asset.service';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';

// Smallest valid PNG (1x1 transparent) — real magic bytes for file-type.
const PNG_FILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const CLEAN_SVG_FILE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="#7c3aed"/></svg>',
);

const MALICIOUS_SVG_FILE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

describe('O2dBrandingAssetService', () => {
  let service: O2dBrandingAssetService;

  const configuration = { id: 'cfg-1', workspaceId: 'ws-1' };

  const entityManager = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    insert: jest.fn(),
  };

  const dataSource = {
    manager: entityManager,
    transaction: jest.fn(
      async (callback: (manager: typeof entityManager) => Promise<unknown>) =>
        callback(entityManager),
    ),
  };

  const fileStorageService = {
    writeFile: jest.fn(),
    readFile: jest.fn(),
  };

  const workspaceRepository = {
    findOne: jest
      .fn()
      .mockResolvedValue({ workspaceCustomApplicationId: 'app-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    workspaceRepository.findOne.mockResolvedValue({
      workspaceCustomApplicationId: 'app-1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        O2dBrandingAssetService,
        O2dBrandingAuditService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: FileStorageService, useValue: fileStorageService },
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: workspaceRepository,
        },
      ],
    }).compile();

    service = module.get(O2dBrandingAssetService);
  });

  const mockConfigurationLookup = () => {
    entityManager.findOneBy.mockImplementation(
      async (_entity: unknown, where: Record<string, unknown>) =>
        where.id === 'cfg-1' && where.workspaceId === 'ws-1'
          ? configuration
          : null,
    );
  };

  describe('uploadAsset', () => {
    it('stores a valid png under a generated content-addressed key', async () => {
      mockConfigurationLookup();
      entityManager.save.mockImplementation(
        async (_entity: unknown, value: Record<string, unknown>) => value,
      );

      const asset = await service.uploadAsset({
        workspaceId: 'ws-1',
        userId: 'user-1',
        configurationId: 'cfg-1',
        slot: 'favicon',
        filename: '../../evil path.png',
        file: PNG_FILE,
      });

      expect(asset.status).toBe(O2dBrandingAssetStatus.VALID);
      expect(asset.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(asset.url).toBe(
        `/branding/asset/${asset.id}/${asset.hash}.png`,
      );

      const writtenFile = fileStorageService.writeFile.mock.calls[0][0];

      // Storage key is generated from config/slot/hash — never from the
      // user-controlled filename (doc 11 path traversal rule).
      expect(writtenFile.resourcePath).toBe(`cfg-1/favicon/${asset.hash}.png`);
      expect(writtenFile.fileFolder).toBe(FileFolder.BrandingAsset);
      expect(writtenFile.applicationUniversalIdentifier).toBe('app-1');

      expect(entityManager.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'branding.asset.uploaded' }),
      );
    });

    it('sanitizes and stores a clean svg', async () => {
      mockConfigurationLookup();
      entityManager.save.mockImplementation(
        async (_entity: unknown, value: Record<string, unknown>) => value,
      );

      const asset = await service.uploadAsset({
        workspaceId: 'ws-1',
        userId: 'user-1',
        configurationId: 'cfg-1',
        slot: 'logoLight',
        filename: 'logo.svg',
        file: CLEAN_SVG_FILE,
      });

      expect(asset.format).toBe('svg');

      const storedFile = fileStorageService.writeFile.mock.calls[0][0]
        .sourceFile as Buffer;

      expect(storedFile.toString('utf-8')).toContain('<circle');
    });

    it('is idempotent for a re-upload of identical content', async () => {
      const existingAsset = {
        id: 'asset-1',
        status: O2dBrandingAssetStatus.VALID,
      };

      entityManager.findOneBy.mockImplementation(
        async (_entity: unknown, where: Record<string, unknown>) => {
          if (where.workspaceId === 'ws-1') {
            return configuration;
          }

          return 'hash' in where ? existingAsset : null;
        },
      );

      const asset = await service.uploadAsset({
        workspaceId: 'ws-1',
        userId: 'user-1',
        configurationId: 'cfg-1',
        slot: 'favicon',
        filename: 'favicon.png',
        file: PNG_FILE,
      });

      expect(asset).toBe(existingAsset);
      expect(fileStorageService.writeFile).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a format outside the slot allowlist',
        { slot: 'emailLogo', filename: 'logo.svg', file: CLEAN_SVG_FILE },
      ],
      [
        'a file whose magic bytes contradict the extension',
        { slot: 'favicon', filename: 'favicon.png', file: CLEAN_SVG_FILE },
      ],
      [
        'a malicious svg',
        { slot: 'logoLight', filename: 'logo.svg', file: MALICIOUS_SVG_FILE },
      ],
      [
        'an oversized svg',
        {
          slot: 'logoLight',
          filename: 'logo.svg',
          file: Buffer.concat([
            CLEAN_SVG_FILE,
            Buffer.alloc(2 * 1024 * 1024, 0x20),
          ]),
        },
      ],
    ])(
      'rejects %s without storing anything and records the rejection',
      async (_label, input) => {
        mockConfigurationLookup();

        await expect(
          service.uploadAsset({
            workspaceId: 'ws-1',
            userId: 'user-1',
            configurationId: 'cfg-1',
            ...input,
          }),
        ).rejects.toThrow(UnprocessableEntityException);

        expect(fileStorageService.writeFile).not.toHaveBeenCalled();
        expect(entityManager.save).not.toHaveBeenCalled();
        expect(entityManager.insert).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ eventType: 'branding.asset.rejected' }),
        );
      },
    );

    it('refuses an unknown slot and a foreign configuration', async () => {
      mockConfigurationLookup();

      await expect(
        service.uploadAsset({
          workspaceId: 'ws-1',
          configurationId: 'cfg-1',
          slot: 'notASlot',
          filename: 'x.png',
          file: PNG_FILE,
        }),
      ).rejects.toThrow('unknown branding asset slot');

      await expect(
        service.uploadAsset({
          workspaceId: 'ws-2',
          configurationId: 'cfg-1',
          slot: 'favicon',
          filename: 'x.png',
          file: PNG_FILE,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAssetContent', () => {
    const storedAsset = {
      id: 'asset-1',
      hash: 'a'.repeat(64),
      format: 'png',
      sizeBytes: 68,
      storageKey: `cfg-1/favicon/${'a'.repeat(64)}.png`,
      status: O2dBrandingAssetStatus.VALID,
      configuration: { workspaceId: 'ws-1' },
    };

    it('streams a VALID asset addressed by id + hash', async () => {
      entityManager.findOne.mockResolvedValue(storedAsset);
      fileStorageService.readFile.mockResolvedValue('stream');

      const content = await service.getAssetContent(
        'asset-1',
        'a'.repeat(64),
        'png',
      );

      expect(content).toEqual({
        stream: 'stream',
        contentType: 'image/png',
        sizeBytes: 68,
      });
      expect(fileStorageService.readFile).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          fileFolder: FileFolder.BrandingAsset,
          resourcePath: storedAsset.storageKey,
        }),
      );
    });

    it('returns null on a miss or an extension mismatch', async () => {
      entityManager.findOne.mockResolvedValue(null);

      await expect(
        service.getAssetContent('asset-1', 'b'.repeat(64), 'png'),
      ).resolves.toBeNull();

      entityManager.findOne.mockResolvedValue(storedAsset);

      await expect(
        service.getAssetContent('asset-1', 'a'.repeat(64), 'svg'),
      ).resolves.toBeNull();

      expect(fileStorageService.readFile).not.toHaveBeenCalled();
    });
  });
});
