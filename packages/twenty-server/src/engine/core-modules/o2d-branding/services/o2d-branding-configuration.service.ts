import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import {
  brandingConfigSchema,
  getPreset,
  type O2DBrandingConfig,
} from 'o2d-branding-core';

import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';

@Injectable()
export class O2dBrandingConfigurationService {
  constructor(
    // Every query below is explicitly workspaceId-scoped and mutations need
    // the raw transactional manager for the audit outbox (doc 18).
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(O2dBrandingConfigurationEntity)
    private readonly configurationRepository: Repository<O2dBrandingConfigurationEntity>,
    private readonly auditService: O2dBrandingAuditService,
  ) {}

  async listForWorkspace(
    workspaceId: string,
  ): Promise<O2dBrandingConfigurationEntity[]> {
    return this.configurationRepository.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  // Cross-workspace IDs surface as 404, never as 403 — existence is not
  // confirmed to other workspaces (doc 19 §3).
  async getForWorkspace(
    workspaceId: string,
    configurationId: string,
  ): Promise<O2dBrandingConfigurationEntity> {
    const configuration = await this.configurationRepository.findOne({
      where: { id: configurationId, workspaceId },
    });

    if (configuration === null) {
      throw new NotFoundException('branding configuration not found');
    }

    return configuration;
  }

  async create(
    workspaceId: string,
    userId: string | undefined,
    input: { name: string; basePreset: string },
  ): Promise<O2dBrandingConfigurationEntity> {
    const preset = getPreset(input.basePreset);

    if (preset === undefined) {
      throw new BadRequestException(
        `unknown base preset "${input.basePreset}"`,
      );
    }

    const existing = await this.configurationRepository.findOne({
      where: { workspaceId, name: input.name },
    });

    if (existing !== null) {
      throw new ConflictException(
        `a configuration named "${input.name}" already exists`,
      );
    }

    const draftConfig: O2DBrandingConfig = {
      schemaVersion: 'o2d.branding.config/1-0-0',
      basePreset: input.basePreset,
      brand: {
        productName: preset.brand.productName,
        shortName: preset.brand.shortName,
      },
      tokens: {},
      assets: {},
    };

    const saved = await this.configurationRepository.manager.transaction(
      async (entityManager) => {
        const configuration = await entityManager.save(
          O2dBrandingConfigurationEntity,
          {
            workspaceId,
            name: input.name,
            draftConfig,
            draftUpdatedAt: new Date(),
            draftUpdatedBy: userId ?? null,
            schemaVersion: draftConfig.schemaVersion,
            createdBy: userId ?? null,
          },
        );

        await this.auditService.record(entityManager, {
          eventType: 'branding.configuration.created',
          workspaceId,
          configurationId: configuration.id,
          actorType: 'user',
          actorId: userId,
          payload: { name: input.name, basePreset: input.basePreset },
        });

        return configuration;
      },
    );

    return saved;
  }

  async updateDraft(
    workspaceId: string,
    userId: string | undefined,
    configurationId: string,
    draftConfig: O2DBrandingConfig,
    expectedDraftUpdatedAt?: Date,
  ): Promise<O2dBrandingConfigurationEntity> {
    const configuration = await this.getForWorkspace(
      workspaceId,
      configurationId,
    );

    // Optimistic lock (doc 19 — PATCH with If-Unmodified-Since semantics).
    if (
      expectedDraftUpdatedAt !== undefined &&
      configuration.draftUpdatedAt !== null &&
      configuration.draftUpdatedAt !== undefined &&
      configuration.draftUpdatedAt.getTime() !==
        expectedDraftUpdatedAt.getTime()
    ) {
      throw new ConflictException(
        'draft was modified by someone else — reload before saving',
      );
    }

    // Fast structural validation on save; the full pipeline runs on
    // validate/publish (doc 06 §4).
    const parsed = brandingConfigSchema.safeParse(draftConfig);

    if (!parsed.success) {
      throw new BadRequestException({
        message: 'draft config is structurally invalid',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const changedAt = new Date();

    const updated = await this.configurationRepository.manager.transaction(
      async (entityManager) => {
        await entityManager.update(
          O2dBrandingConfigurationEntity,
          { id: configuration.id },
          {
            draftConfig,
            draftUpdatedAt: changedAt,
            draftUpdatedBy: userId ?? null,
            schemaVersion: draftConfig.schemaVersion,
          },
        );

        await this.auditService.record(entityManager, {
          eventType: 'branding.configuration.updated',
          workspaceId,
          configurationId: configuration.id,
          actorType: 'user',
          actorId: userId,
          payload: { changedPaths: Object.keys(draftConfig.tokens) },
        });

        return entityManager.findOneByOrFail(O2dBrandingConfigurationEntity, {
          id: configuration.id,
        });
      },
    );

    return updated;
  }
}
