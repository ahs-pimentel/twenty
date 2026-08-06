import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { type O2dBrandingResolvedArtifact } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';

export type O2dBrandingValidationRun = {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  draftHash: string;
  result: {
    status: 'valid' | 'failed';
    issues: unknown[];
  } | null;
  startedAt: string;
  finishedAt: string | null;
};

const PUBLISHED_ARTIFACT_TTL_MS = 24 * 60 * 60 * 1000;
const VALIDATION_RUN_TTL_MS = 60 * 60 * 1000;

// Redis layer of doc 07 §5: `o2d:branding:ws:{workspaceId}` caches the
// published artifact for 24h and is invalidated on publish/rollback.
// Validation runs are transient coordination state (doc 19 §validate —
// 202 + validationRunId): re-runnable, idempotent by draft hash, so Redis
// with a 1h TTL is their system of record; completion lands durably in
// the audit trail.
@Injectable()
export class O2dBrandingCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  async getPublishedArtifact(
    workspaceId: string,
  ): Promise<O2dBrandingResolvedArtifact | undefined> {
    return this.cacheStorage.get<O2dBrandingResolvedArtifact>(
      `o2d:branding:ws:${workspaceId}`,
    );
  }

  async setPublishedArtifact(
    workspaceId: string,
    artifact: O2dBrandingResolvedArtifact,
  ): Promise<void> {
    await this.cacheStorage.set(
      `o2d:branding:ws:${workspaceId}`,
      artifact,
      PUBLISHED_ARTIFACT_TTL_MS,
    );
  }

  async invalidatePublishedArtifact(workspaceId: string): Promise<void> {
    await this.cacheStorage.del(`o2d:branding:ws:${workspaceId}`);
  }

  async getValidationRun(
    configurationId: string,
  ): Promise<O2dBrandingValidationRun | undefined> {
    return this.cacheStorage.get<O2dBrandingValidationRun>(
      `o2d:branding:validation:${configurationId}`,
    );
  }

  async setValidationRun(
    configurationId: string,
    run: O2dBrandingValidationRun,
  ): Promise<void> {
    await this.cacheStorage.set(
      `o2d:branding:validation:${configurationId}`,
      run,
      VALIDATION_RUN_TTL_MS,
    );
  }
}
