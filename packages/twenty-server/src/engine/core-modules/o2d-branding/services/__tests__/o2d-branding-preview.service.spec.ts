import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { O2dBrandingAssetStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingPreviewService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-preview.service';

const buildValidDraft = () => ({
  schemaVersion: 'o2d.branding.config/1-0-0' as const,
  basePreset: 'preset.odois',
  brand: { productName: 'Cliente X', shortName: 'X' },
  tokens: {},
  assets: {},
});

describe('O2dBrandingPreviewService', () => {
  let service: O2dBrandingPreviewService;

  const entityManager = { findOneBy: jest.fn() };
  const dataSource = { manager: entityManager };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        O2dBrandingPreviewService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get(O2dBrandingPreviewService);
  });

  it('builds an ephemeral artifact from a valid draft', async () => {
    entityManager.findOneBy.mockResolvedValue({
      id: 'cfg-1',
      workspaceId: 'ws-1',
      draftConfig: buildValidDraft(),
    });

    const preview = await service.previewDraft('ws-1', 'cfg-1');

    expect(preview.status).toBe('valid');
    expect(preview.artifact).not.toBeNull();
    expect(preview.artifact?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.artifact?.cssLight['--t-color-blue9']).toBe('#7c3aed');
    expect(preview.artifact?.brand.productName).toBe('Cliente X');
  });

  it('returns issues without an artifact for an invalid draft', async () => {
    entityManager.findOneBy.mockResolvedValue({
      id: 'cfg-1',
      workspaceId: 'ws-1',
      draftConfig: {
        ...buildValidDraft(),
        tokens: { 'text.primary': 'not-a-color' },
      },
    });

    const preview = await service.previewDraft('ws-1', 'cfg-1');

    expect(preview.status).toBe('failed');
    expect(preview.artifact).toBeNull();
    expect(preview.issues.length).toBeGreaterThan(0);
  });

  it('resolves draft asset refs to public URLs, dropping stale ones', async () => {
    const draft = {
      ...buildValidDraft(),
      assets: {
        favicon: { assetId: 'a-1', hash: 'a'.repeat(64) },
        logoLight: { assetId: 'a-2', hash: 'b'.repeat(64) },
      },
    };

    entityManager.findOneBy.mockImplementation(
      async (_entity: unknown, where: Record<string, unknown>) => {
        if (where.id === 'cfg-1') {
          return { id: 'cfg-1', workspaceId: 'ws-1', draftConfig: draft };
        }
        if (
          where.id === 'a-1' &&
          where.hash === 'a'.repeat(64) &&
          where.status === O2dBrandingAssetStatus.VALID
        ) {
          return {
            id: 'a-1',
            hash: 'a'.repeat(64),
            format: 'png',
            url: '/branding/asset/a-1/hash.png',
          };
        }

        return null;
      },
    );

    const preview = await service.previewDraft('ws-1', 'cfg-1');

    expect(preview.status).toBe('valid');
    expect(preview.artifact?.assets).toEqual({
      favicon: {
        url: '/branding/asset/a-1/hash.png',
        hash: 'a'.repeat(64),
        format: 'png',
      },
    });
  });

  it('surfaces a missing draft as a failed preview', async () => {
    entityManager.findOneBy.mockResolvedValue({
      id: 'cfg-1',
      workspaceId: 'ws-1',
      draftConfig: null,
    });

    const preview = await service.previewDraft('ws-1', 'cfg-1');

    expect(preview.status).toBe('failed');
    expect(preview.issues[0]).toMatchObject({ rule: 'draft.missing' });
  });

  it('refuses a foreign configuration', async () => {
    entityManager.findOneBy.mockResolvedValue(null);

    await expect(service.previewDraft('ws-2', 'cfg-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
