import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource, type EntityManager } from 'typeorm';
import {
  currentAdapter,
  UPSTREAM_BASE_COMMIT,
  validateBrandingConfig,
  type ValidationIssue,
} from 'o2d-branding-core';

import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingPublicationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-publication.entity';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import {
  O2dBrandingPublicationStatus,
  O2dBrandingVersionStatus,
} from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';

export type O2dBrandingValidationOutcome = {
  status: 'valid' | 'failed';
  issues: ValidationIssue[];
};

// Publication pipeline (docs 07 §4, 15): validate → generate artifact via
// the current adapter → immutable version + publication row + atomic
// pointer swap + audit, all in one transaction. Validation runs
// synchronously in this increment; the async job (202 + validationRunId,
// doc 19) is a follow-up.
@Injectable()
export class O2dBrandingPublicationService {
  constructor(
    @InjectDataSource('core')
    private readonly dataSource: DataSource,
    private readonly auditService: O2dBrandingAuditService,
  ) {}

  async validateDraft(
    workspaceId: string,
    configurationId: string,
  ): Promise<O2dBrandingValidationOutcome> {
    const configuration = await this.findConfiguration(
      this.dataSource.manager,
      workspaceId,
      configurationId,
    );

    if (
      configuration.draftConfig === null ||
      configuration.draftConfig === undefined
    ) {
      return {
        status: 'failed',
        issues: [
          {
            rule: 'draft.missing',
            severity: 'error',
            message: 'configuration has no draft to validate',
          },
        ],
      };
    }

    const result = validateBrandingConfig(configuration.draftConfig);

    return { status: result.status, issues: result.issues };
  }

  async publish(
    workspaceId: string,
    userId: string | undefined,
    configurationId: string,
    changelog?: string,
  ): Promise<O2dBrandingVersionEntity> {
    return this.dataSource.transaction(async (entityManager) => {
      const configuration = await this.findConfiguration(
        entityManager,
        workspaceId,
        configurationId,
      );

      if (
        configuration.draftConfig === null ||
        configuration.draftConfig === undefined
      ) {
        throw new UnprocessableEntityException(
          'configuration has no draft to publish',
        );
      }

      const validation = validateBrandingConfig(configuration.draftConfig);

      if (validation.status !== 'valid' || validation.normalization === null) {
        await entityManager.insert(O2dBrandingPublicationEntity, {
          configurationId: configuration.id,
          versionId: configuration.publishedVersionId ?? undefined,
          status: O2dBrandingPublicationStatus.FAILED,
          publishedBy: userId ?? null,
          validationResult: { status: 'failed', issues: validation.issues },
          failureReason: 'VALIDATION_FAILED',
        });

        await this.auditService.record(entityManager, {
          eventType: 'branding.publication.failed',
          workspaceId,
          configurationId: configuration.id,
          actorType: 'user',
          actorId: userId,
          payload: { stage: 'validation' },
        });

        throw new UnprocessableEntityException({
          message: 'draft failed validation — publication blocked',
          issues: validation.issues.filter(
            (issue) => issue.severity === 'error',
          ),
        });
      }

      const resolved = validation.normalization.resolved;

      if (resolved === null) {
        throw new UnprocessableEntityException('draft failed to normalize');
      }

      const overrides = currentAdapter.mapThemeTokens(resolved.tokens);

      const previousVersion =
        configuration.publishedVersionId !== null &&
        configuration.publishedVersionId !== undefined
          ? await entityManager.findOneBy(O2dBrandingVersionEntity, {
              id: configuration.publishedVersionId,
            })
          : null;

      const nextNumber = await this.nextVersionNumber(
        entityManager,
        configuration.id,
      );

      const version = await entityManager.save(O2dBrandingVersionEntity, {
        configurationId: configuration.id,
        number: nextNumber,
        status: O2dBrandingVersionStatus.PUBLISHED,
        snapshot: resolved,
        assetManifest: resolved.assets,
        artifact: {
          cssLight: overrides.light,
          cssDark: overrides.dark,
          meta: {
            adapterVersion: currentAdapter.version,
            hash: resolved.meta.hash,
            productName: configuration.draftConfig.brand.productName,
            shortName: configuration.draftConfig.brand.shortName,
          },
        },
        schemaVersion: resolved.meta.schemaVersion,
        adapterVersion: currentAdapter.version,
        twentyVersion: { baseCommit: UPSTREAM_BASE_COMMIT },
        hash: resolved.meta.hash,
        changelog: changelog ?? null,
        validationResult: {
          status: 'valid' as const,
          issues: validation.issues,
        },
        createdBy: userId ?? null,
      });

      if (previousVersion !== null) {
        await entityManager.update(
          O2dBrandingVersionEntity,
          { id: previousVersion.id },
          { status: O2dBrandingVersionStatus.SUPERSEDED },
        );
      }

      await entityManager.update(
        O2dBrandingConfigurationEntity,
        { id: configuration.id },
        { publishedVersionId: version.id },
      );

      await entityManager.insert(O2dBrandingPublicationEntity, {
        configurationId: configuration.id,
        versionId: version.id,
        status: O2dBrandingPublicationStatus.SUCCEEDED,
        publishedBy: userId ?? null,
        validationResult: { status: 'valid', warnings: validation.issues },
      });

      await this.auditService.record(entityManager, {
        eventType: 'branding.published',
        workspaceId,
        configurationId: configuration.id,
        versionId: version.id,
        actorType: 'user',
        actorId: userId,
        payload: {
          number: version.number,
          artifactHash: version.hash,
          adapterVersion: currentAdapter.version,
        },
      });

      return version;
    });
  }

  async rollback(
    workspaceId: string,
    userId: string | undefined,
    configurationId: string,
    toVersionNumber: number,
    reason: string,
  ): Promise<O2dBrandingVersionEntity> {
    return this.dataSource.transaction(async (entityManager) => {
      const configuration = await this.findConfiguration(
        entityManager,
        workspaceId,
        configurationId,
      );

      const targetVersion = await entityManager.findOneBy(
        O2dBrandingVersionEntity,
        { configurationId: configuration.id, number: toVersionNumber },
      );

      if (targetVersion === null) {
        throw new NotFoundException(
          `version ${toVersionNumber} not found for this configuration`,
        );
      }

      // Revalidation against the installed adapter (doc 15 §4): a snapshot
      // produced by another adapter version may reference targets that no
      // longer exist — blocked until re-edited as a draft.
      if (targetVersion.adapterVersion !== currentAdapter.version) {
        throw new UnprocessableEntityException(
          `version ${toVersionNumber} was generated by adapter ${targetVersion.adapterVersion}; current is ${currentAdapter.version} — restore it as a draft and republish`,
        );
      }

      const previousVersion =
        configuration.publishedVersionId !== null &&
        configuration.publishedVersionId !== undefined
          ? await entityManager.findOneBy(O2dBrandingVersionEntity, {
              id: configuration.publishedVersionId,
            })
          : null;

      const nextNumber = await this.nextVersionNumber(
        entityManager,
        configuration.id,
      );

      // Rollback never overwrites history — always a new version based on
      // the restored one (doc 15 §4).
      const newVersion = await entityManager.save(O2dBrandingVersionEntity, {
        configurationId: configuration.id,
        number: nextNumber,
        status: O2dBrandingVersionStatus.PUBLISHED,
        snapshot: targetVersion.snapshot,
        assetManifest: targetVersion.assetManifest,
        artifact: targetVersion.artifact,
        schemaVersion: targetVersion.schemaVersion,
        adapterVersion: targetVersion.adapterVersion,
        twentyVersion: targetVersion.twentyVersion,
        hash: targetVersion.hash,
        basedOnVersionId: targetVersion.id,
        changelog: `rollback to v${toVersionNumber}: ${reason}`,
        validationResult: targetVersion.validationResult,
        createdBy: userId ?? null,
      });

      if (previousVersion !== null) {
        await entityManager.update(
          O2dBrandingVersionEntity,
          { id: previousVersion.id },
          { status: O2dBrandingVersionStatus.ROLLED_BACK },
        );
      }

      await entityManager.update(
        O2dBrandingConfigurationEntity,
        { id: configuration.id },
        { publishedVersionId: newVersion.id },
      );

      await entityManager.insert(O2dBrandingPublicationEntity, {
        configurationId: configuration.id,
        versionId: newVersion.id,
        status: O2dBrandingPublicationStatus.SUCCEEDED,
        publishedBy: userId ?? null,
      });

      await this.auditService.record(entityManager, {
        eventType: 'branding.rolled_back',
        workspaceId,
        configurationId: configuration.id,
        versionId: newVersion.id,
        actorType: 'user',
        actorId: userId,
        payload: {
          restoredFromVersion: toVersionNumber,
          newVersionNumber: newVersion.number,
          reason,
        },
      });

      return newVersion;
    });
  }

  async listVersions(
    workspaceId: string,
    configurationId: string,
  ): Promise<O2dBrandingVersionEntity[]> {
    await this.findConfiguration(
      this.dataSource.manager,
      workspaceId,
      configurationId,
    );

    return this.dataSource.manager.find(O2dBrandingVersionEntity, {
      where: { configurationId },
      order: { number: 'DESC' },
    });
  }

  private async findConfiguration(
    entityManager: EntityManager,
    workspaceId: string,
    configurationId: string,
  ): Promise<O2dBrandingConfigurationEntity> {
    const configuration = await entityManager.findOneBy(
      O2dBrandingConfigurationEntity,
      { id: configurationId, workspaceId },
    );

    if (configuration === null) {
      throw new NotFoundException('branding configuration not found');
    }

    return configuration;
  }

  private async nextVersionNumber(
    entityManager: EntityManager,
    configurationId: string,
  ): Promise<number> {
    const latest = await entityManager.findOne(O2dBrandingVersionEntity, {
      where: { configurationId },
      order: { number: 'DESC' },
    });

    return (latest?.number ?? 0) + 1;
  }
}
