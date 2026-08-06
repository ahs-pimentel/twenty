import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';
import { v4 } from 'uuid';
import { canonicalHash, validateBrandingConfig } from 'o2d-branding-core';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import {
  O2D_BRANDING_VALIDATION_JOB_NAME,
  type O2dBrandingValidationJobData,
} from 'src/engine/core-modules/o2d-branding/jobs/o2d-branding-validation.job-constants';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';
import {
  O2dBrandingCacheService,
  type O2dBrandingValidationRun,
} from 'src/engine/core-modules/o2d-branding/services/o2d-branding-cache.service';

// Async validation contract (doc 19): starting returns a run id
// immediately (the GraphQL analogue of 202 + validationRunId); the result
// is polled via the run query. Idempotent by draft hash — re-triggering on
// an unchanged draft returns the existing run instead of a new job.
@Injectable()
export class O2dBrandingValidationRunService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectMessageQueue(MessageQueue.workspaceQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly cacheService: O2dBrandingCacheService,
    private readonly auditService: O2dBrandingAuditService,
  ) {}

  async start(
    workspaceId: string,
    userId: string | undefined,
    configurationId: string,
  ): Promise<O2dBrandingValidationRun> {
    const configuration = await this.findConfigurationOrThrow(
      workspaceId,
      configurationId,
    );

    if (
      configuration.draftConfig === null ||
      configuration.draftConfig === undefined
    ) {
      throw new NotFoundException('configuration has no draft to validate');
    }

    const draftHash = canonicalHash(configuration.draftConfig);
    const existingRun =
      await this.cacheService.getValidationRun(configurationId);

    if (
      existingRun !== undefined &&
      existingRun.draftHash === draftHash &&
      existingRun.status !== 'FAILED'
    ) {
      return existingRun;
    }

    const run: O2dBrandingValidationRun = {
      id: v4(),
      status: 'RUNNING',
      draftHash,
      result: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    await this.cacheService.setValidationRun(configurationId, run);

    await this.auditService.record(this.dataSource.manager, {
      eventType: 'branding.validation.started',
      workspaceId,
      configurationId,
      actorType: 'user',
      actorId: userId,
      payload: { validationRunId: run.id, draftHash },
    });

    await this.messageQueueService.add<O2dBrandingValidationJobData>(
      O2D_BRANDING_VALIDATION_JOB_NAME,
      { workspaceId, configurationId, validationRunId: run.id },
    );

    return run;
  }

  async getRun(
    workspaceId: string,
    configurationId: string,
  ): Promise<O2dBrandingValidationRun | null> {
    await this.findConfigurationOrThrow(workspaceId, configurationId);

    return (await this.cacheService.getValidationRun(configurationId)) ?? null;
  }

  // Worker-side execution. A run that is no longer the current one for its
  // configuration (draft changed, cache expired) completes silently — the
  // idempotency key is the draft hash, not the job.
  async execute(data: O2dBrandingValidationJobData): Promise<void> {
    const run = await this.cacheService.getValidationRun(data.configurationId);

    if (run === undefined || run.id !== data.validationRunId) {
      return;
    }

    const configuration = await this.dataSource.manager.findOneBy(
      O2dBrandingConfigurationEntity,
      { id: data.configurationId, workspaceId: data.workspaceId },
    );

    if (
      configuration === null ||
      configuration.draftConfig === null ||
      configuration.draftConfig === undefined ||
      canonicalHash(configuration.draftConfig) !== run.draftHash
    ) {
      await this.cacheService.setValidationRun(data.configurationId, {
        ...run,
        status: 'FAILED',
        finishedAt: new Date().toISOString(),
      });

      return;
    }

    const validation = validateBrandingConfig(configuration.draftConfig);

    const completedRun: O2dBrandingValidationRun = {
      ...run,
      status: 'COMPLETED',
      result: { status: validation.status, issues: validation.issues },
      finishedAt: new Date().toISOString(),
    };

    await this.cacheService.setValidationRun(
      data.configurationId,
      completedRun,
    );

    await this.auditService.record(this.dataSource.manager, {
      eventType: 'branding.validation.completed',
      workspaceId: data.workspaceId,
      configurationId: data.configurationId,
      actorType: 'system',
      payload: {
        validationRunId: run.id,
        status: validation.status,
        errorCount: validation.issues.filter(
          (issue) => issue.severity === 'error',
        ).length,
      },
    });
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
}
