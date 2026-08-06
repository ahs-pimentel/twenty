import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { canonicalHash } from 'o2d-branding-core';

import { getQueueToken } from 'src/engine/core-modules/message-queue/utils/get-queue-token.util';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { O2D_BRANDING_VALIDATION_JOB_NAME } from 'src/engine/core-modules/o2d-branding/jobs/o2d-branding-validation.job-constants';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';
import { O2dBrandingCacheService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-cache.service';
import { O2dBrandingValidationRunService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-validation-run.service';

const buildValidDraft = () => ({
  schemaVersion: 'o2d.branding.config/1-0-0' as const,
  basePreset: 'preset.odois',
  brand: { productName: 'Cliente X', shortName: 'X' },
  tokens: {},
  assets: {},
});

describe('O2dBrandingValidationRunService', () => {
  let service: O2dBrandingValidationRunService;

  const entityManager = { findOneBy: jest.fn(), insert: jest.fn() };
  const dataSource = { manager: entityManager };
  const messageQueueService = { add: jest.fn() };
  const cacheService = {
    getValidationRun: jest.fn(),
    setValidationRun: jest.fn(),
  };

  const configuration = {
    id: 'cfg-1',
    workspaceId: 'ws-1',
    draftConfig: buildValidDraft(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    entityManager.findOneBy.mockImplementation(
      async (_entity: unknown, where: Record<string, unknown>) =>
        where.id === 'cfg-1' && where.workspaceId === 'ws-1'
          ? configuration
          : null,
    );
    cacheService.getValidationRun.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        O2dBrandingValidationRunService,
        O2dBrandingAuditService,
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: getQueueToken(MessageQueue.workspaceQueue),
          useValue: messageQueueService,
        },
        { provide: O2dBrandingCacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get(O2dBrandingValidationRunService);
  });

  describe('start', () => {
    it('answers immediately with a RUNNING run and enqueues the job', async () => {
      const run = await service.start('ws-1', 'user-1', 'cfg-1');

      expect(run.status).toBe('RUNNING');
      expect(run.draftHash).toBe(canonicalHash(configuration.draftConfig));
      expect(cacheService.setValidationRun).toHaveBeenCalledWith('cfg-1', run);
      expect(messageQueueService.add).toHaveBeenCalledWith(
        O2D_BRANDING_VALIDATION_JOB_NAME,
        {
          workspaceId: 'ws-1',
          configurationId: 'cfg-1',
          validationRunId: run.id,
        },
      );
      expect(entityManager.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'branding.validation.started' }),
      );
    });

    it('is idempotent per draft hash — an unchanged draft reuses the run', async () => {
      const existingRun = {
        id: 'run-1',
        status: 'COMPLETED' as const,
        draftHash: canonicalHash(configuration.draftConfig),
        result: { status: 'valid' as const, issues: [] },
        startedAt: '2026-08-06T00:00:00Z',
        finishedAt: '2026-08-06T00:00:01Z',
      };

      cacheService.getValidationRun.mockResolvedValue(existingRun);

      const run = await service.start('ws-1', 'user-1', 'cfg-1');

      expect(run).toBe(existingRun);
      expect(messageQueueService.add).not.toHaveBeenCalled();
    });

    it('refuses a foreign configuration', async () => {
      await expect(service.start('ws-2', 'user-1', 'cfg-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('execute', () => {
    const runningRun = () => ({
      id: 'run-1',
      status: 'RUNNING' as const,
      draftHash: canonicalHash(configuration.draftConfig),
      result: null,
      startedAt: '2026-08-06T00:00:00Z',
      finishedAt: null,
    });

    it('completes the run with the validation result and audits it', async () => {
      cacheService.getValidationRun.mockResolvedValue(runningRun());

      await service.execute({
        workspaceId: 'ws-1',
        configurationId: 'cfg-1',
        validationRunId: 'run-1',
      });

      expect(cacheService.setValidationRun).toHaveBeenCalledWith(
        'cfg-1',
        expect.objectContaining({
          status: 'COMPLETED',
          result: expect.objectContaining({ status: 'valid' }),
        }),
      );
      expect(entityManager.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'branding.validation.completed',
        }),
      );
    });

    it('skips silently when the run is no longer the current one', async () => {
      cacheService.getValidationRun.mockResolvedValue({
        ...runningRun(),
        id: 'run-2',
      });

      await service.execute({
        workspaceId: 'ws-1',
        configurationId: 'cfg-1',
        validationRunId: 'run-1',
      });

      expect(cacheService.setValidationRun).not.toHaveBeenCalled();
    });

    it('marks the run FAILED when the draft changed underneath it', async () => {
      cacheService.getValidationRun.mockResolvedValue({
        ...runningRun(),
        draftHash: 'stale-hash',
      });

      await service.execute({
        workspaceId: 'ws-1',
        configurationId: 'cfg-1',
        validationRunId: 'run-1',
      });

      expect(cacheService.setValidationRun).toHaveBeenCalledWith(
        'cfg-1',
        expect.objectContaining({ status: 'FAILED' }),
      );
    });
  });
});
