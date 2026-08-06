import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { createHash } from 'node:crypto';
import { type Readable } from 'node:stream';

import { FileTypeParser } from 'file-type';
import { FileFolder } from 'twenty-shared/types';
import { DataSource, Repository } from 'typeorm';
import { v4 } from 'uuid';
import { type O2DAssetSlot } from 'o2d-branding-core';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import {
  O2D_BRANDING_ASSET_RULES,
  type O2dBrandingAssetFormat,
} from 'src/engine/core-modules/o2d-branding/constants/o2d-branding-asset-rules.constant';
import { O2dBrandingAssetEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-asset.entity';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingAssetStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';
import { sanitizeO2dBrandingSvg } from 'src/engine/core-modules/o2d-branding/utils/sanitize-o2d-branding-svg.util';

const CONTENT_TYPE_BY_FORMAT: Record<O2dBrandingAssetFormat, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  ico: 'image/x-icon',
};

export type O2dBrandingAssetUploadInput = {
  workspaceId: string;
  userId?: string;
  configurationId: string;
  slot: string;
  filename: string;
  file: Buffer;
};

export type O2dBrandingAssetContent = {
  stream: Readable;
  contentType: string;
  sizeBytes: number;
};

// Asset ingestion pipeline (doc 11 §3): size ceiling → real MIME via magic
// bytes coherent with the declared extension → SVG allowlist sanitization →
// SHA-256 of the final binary → FileStorage under a generated key
// (brandingId/slot/hash.ext — never the user's filename) → registry row.
// Any check failing raises and records branding.asset.rejected; nothing is
// stored. Dimension validation and derived variants (favicon multi-size,
// raster fallbacks) are deferred follow-ups.
@Injectable()
export class O2dBrandingAssetService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly fileStorageService: FileStorageService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly auditService: O2dBrandingAuditService,
  ) {}

  async uploadAsset(
    input: O2dBrandingAssetUploadInput,
  ): Promise<O2dBrandingAssetEntity> {
    const slot = this.parseSlotOrThrow(input.slot);
    const configuration = await this.findConfigurationOrThrow(
      input.workspaceId,
      input.configurationId,
    );

    const { format, finalFile } = await this.validateOrReject(input, slot);

    const hash = createHash('sha256').update(finalFile).digest('hex');

    const existingAsset = await this.dataSource.manager.findOneBy(
      O2dBrandingAssetEntity,
      { configurationId: configuration.id, type: slot, hash },
    );

    if (
      existingAsset !== null &&
      existingAsset.status === O2dBrandingAssetStatus.VALID
    ) {
      return existingAsset;
    }

    const assetId = v4();
    const storageKey = `${configuration.id}/${slot}/${hash}.${format}`;

    await this.fileStorageService.writeFile({
      sourceFile: finalFile,
      resourcePath: storageKey,
      fileFolder: FileFolder.BrandingAsset,
      applicationUniversalIdentifier:
        await this.findApplicationUniversalIdentifierOrThrow(input.workspaceId),
      workspaceId: input.workspaceId,
      settings: { isTemporaryFile: false, toDelete: false },
    });

    return this.dataSource.transaction(async (entityManager) => {
      const asset = await entityManager.save(O2dBrandingAssetEntity, {
        id: assetId,
        configurationId: configuration.id,
        type: slot,
        name: input.filename,
        format,
        sizeBytes: finalFile.length,
        hash,
        storageKey,
        url: `/branding/asset/${assetId}/${hash}.${format}`,
        status: O2dBrandingAssetStatus.VALID,
        createdBy: input.userId ?? null,
      });

      await this.auditService.record(entityManager, {
        eventType: 'branding.asset.uploaded',
        workspaceId: input.workspaceId,
        configurationId: configuration.id,
        actorType: 'user',
        actorId: input.userId,
        payload: { assetId: asset.id, slot, format, hash },
      });

      return asset;
    });
  }

  async listAssets(
    workspaceId: string,
    configurationId: string,
  ): Promise<O2dBrandingAssetEntity[]> {
    const configuration = await this.findConfigurationOrThrow(
      workspaceId,
      configurationId,
    );

    return this.dataSource.manager.find(O2dBrandingAssetEntity, {
      where: {
        configurationId: configuration.id,
        status: O2dBrandingAssetStatus.VALID,
      },
      order: { createdAt: 'DESC' },
    });
  }

  // Public serving path (doc 11 §4): the id+hash pair in the URL is the
  // access key — a mismatch or a non-VALID status yields null (404),
  // never a hint about what exists.
  async getAssetContent(
    assetId: string,
    hash: string,
    extension: string,
  ): Promise<O2dBrandingAssetContent | null> {
    const asset = await this.dataSource.manager.findOne(
      O2dBrandingAssetEntity,
      {
        where: { id: assetId, hash, status: O2dBrandingAssetStatus.VALID },
        relations: { configuration: true },
      },
    );

    if (asset === null || asset.format !== extension) {
      return null;
    }

    const workspaceId = asset.configuration.workspaceId;

    const stream = await this.fileStorageService.readFile({
      workspaceId,
      applicationUniversalIdentifier:
        await this.findApplicationUniversalIdentifierOrThrow(workspaceId),
      fileFolder: FileFolder.BrandingAsset,
      resourcePath: asset.storageKey,
    });

    return {
      stream,
      contentType:
        CONTENT_TYPE_BY_FORMAT[asset.format as O2dBrandingAssetFormat],
      sizeBytes: asset.sizeBytes,
    };
  }

  private parseSlotOrThrow(slot: string): O2DAssetSlot {
    if (!(slot in O2D_BRANDING_ASSET_RULES.slots)) {
      throw new BadRequestException(`unknown branding asset slot "${slot}"`);
    }

    return slot as O2DAssetSlot;
  }

  private async validateOrReject(
    input: O2dBrandingAssetUploadInput,
    slot: O2DAssetSlot,
  ): Promise<{ format: O2dBrandingAssetFormat; finalFile: Buffer }> {
    try {
      return await this.validateAndPrepare(input, slot);
    } catch (error) {
      await this.auditService.record(this.dataSource.manager, {
        eventType: 'branding.asset.rejected',
        workspaceId: input.workspaceId,
        configurationId: input.configurationId,
        actorType: 'user',
        actorId: input.userId,
        payload: {
          slot,
          filename: input.filename,
          reason: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  private async validateAndPrepare(
    input: O2dBrandingAssetUploadInput,
    slot: O2DAssetSlot,
  ): Promise<{ format: O2dBrandingAssetFormat; finalFile: Buffer }> {
    const declaredExtension = input.filename
      .split('.')
      .pop()
      ?.toLowerCase() as O2dBrandingAssetFormat;
    const slotRules = O2D_BRANDING_ASSET_RULES.slots[slot];

    if (!slotRules.formats.includes(declaredExtension)) {
      throw new UnprocessableEntityException(
        `slot "${slot}" accepts ${slotRules.formats.join(', ')} — got "${declaredExtension}"`,
      );
    }

    const maxBytes = O2D_BRANDING_ASSET_RULES.maxBytesByFormat[
      declaredExtension
    ];

    if (input.file.length === 0 || input.file.length > maxBytes) {
      throw new UnprocessableEntityException(
        `file size ${input.file.length} exceeds the ${maxBytes} byte limit for ${declaredExtension}`,
      );
    }

    if (declaredExtension === 'svg') {
      const result = sanitizeO2dBrandingSvg(input.file.toString('utf-8'));

      if (!result.accepted) {
        throw new UnprocessableEntityException(result.reason);
      }

      return { format: 'svg', finalFile: Buffer.from(result.sanitized) };
    }

    const detected = await new FileTypeParser().fromBuffer(input.file);
    const detectedExtension =
      detected?.ext ?? (this.hasIcoMagicBytes(input.file) ? 'ico' : undefined);

    if (detectedExtension !== declaredExtension) {
      throw new UnprocessableEntityException(
        `file content is "${detectedExtension ?? 'unknown'}" but the extension declares "${declaredExtension}"`,
      );
    }

    return { format: declaredExtension, finalFile: input.file };
  }

  // ICO containers are not covered by every file-type version — the
  // reserved+type header (00 00 01 00) is checked directly as a fallback.
  private hasIcoMagicBytes(file: Buffer): boolean {
    return (
      file.length >= 4 &&
      file[0] === 0x00 &&
      file[1] === 0x00 &&
      file[2] === 0x01 &&
      file[3] === 0x00
    );
  }

  private async findConfigurationOrThrow(
    workspaceId: string,
    configurationId: string,
  ): Promise<O2dBrandingConfigurationEntity> {
    const configuration = await this.dataSource.manager.findOneBy(
      O2dBrandingConfigurationEntity,
      { id: configurationId, workspaceId },
    );

    if (configuration === null) {
      throw new NotFoundException('branding configuration not found');
    }

    return configuration;
  }

  private async findApplicationUniversalIdentifierOrThrow(
    workspaceId: string,
  ): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['workspaceCustomApplicationId'],
      withDeleted: true,
    });

    if (workspace === null) {
      throw new NotFoundException(`workspace ${workspaceId} not found`);
    }

    return workspace.workspaceCustomApplicationId;
  }
}
