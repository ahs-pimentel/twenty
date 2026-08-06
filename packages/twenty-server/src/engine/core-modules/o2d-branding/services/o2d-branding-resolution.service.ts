import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';
import { type ResolvedAssetMap } from 'o2d-branding-core';

import { O2dBrandingAssetEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-asset.entity';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import {
  O2dBrandingAssetStatus,
  O2dBrandingConfigurationStatus,
} from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingCacheService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-cache.service';
import {
  O2dBrandingDistributionService,
  type O2dBrandingResolvedArtifact,
  type O2dBrandingResolvedAsset,
} from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';

// Workspace → published artifact resolution (docs 07 §3, 12) behind the
// Redis cache of doc 07 §5. Domain-based resolution arrives in phase 5;
// every failure path falls back to the distribution artifact — never a
// broken theme.
@Injectable()
export class O2dBrandingResolutionService {
  private readonly logger = new Logger(O2dBrandingResolutionService.name);

  constructor(
    // Public runtime resolution runs outside any authenticated workspace
    // context (the workspace comes from the Origin header), and versions
    // carry no workspaceId column — scoping happens via configurationId.
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(O2dBrandingConfigurationEntity)
    private readonly configurationRepository: Repository<O2dBrandingConfigurationEntity>,
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(O2dBrandingVersionEntity)
    private readonly versionRepository: Repository<O2dBrandingVersionEntity>,
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(O2dBrandingAssetEntity)
    private readonly assetRepository: Repository<O2dBrandingAssetEntity>,
    private readonly distributionService: O2dBrandingDistributionService,
    private readonly cacheService: O2dBrandingCacheService,
  ) {}

  async resolveByWorkspace(
    workspaceId: string,
  ): Promise<O2dBrandingResolvedArtifact> {
    try {
      // Redis first (doc 07 §5) — publish/rollback invalidate the entry,
      // so a hit is always the current published artifact.
      const cachedArtifact =
        await this.cacheService.getPublishedArtifact(workspaceId);

      if (cachedArtifact !== undefined) {
        return cachedArtifact;
      }

      const resolvedArtifact = await this.resolveFromDatabase(workspaceId);

      // Only workspace-published artifacts are cached — fallbacks would
      // pin the distribution identity for 24h past the next publication.
      if (resolvedArtifact.meta.source === 'workspace') {
        await this.cacheService.setPublishedArtifact(
          workspaceId,
          resolvedArtifact,
        );
      }

      return resolvedArtifact;
    } catch (error) {
      // Resolution must never break the client — degrade to the
      // distribution identity and report (doc 06 §4 behaviors).
      this.logger.warn(
        `branding resolution failed for workspace ${workspaceId}: ${error}`,
      );

      return this.distributionService.getDistributionArtifact();
    }
  }

  private async resolveFromDatabase(
    workspaceId: string,
  ): Promise<O2dBrandingResolvedArtifact> {
    const configuration = await this.configurationRepository.findOne({
      where: {
        workspaceId,
        status: O2dBrandingConfigurationStatus.ACTIVE,
      },
      order: { createdAt: 'ASC' },
    });

    if (
      configuration === null ||
      configuration.publishedVersionId === null ||
      configuration.publishedVersionId === undefined
    ) {
      return this.distributionService.getDistributionArtifact();
    }

    const version = await this.versionRepository.findOneBy({
      id: configuration.publishedVersionId,
    });

    if (version === null || version.artifact === null) {
      return this.distributionService.getDistributionArtifact();
    }

    const artifact = version.artifact;

    if (artifact === undefined) {
      return this.distributionService.getDistributionArtifact();
    }

    return {
      hash: version.hash,
      cssLight: artifact.cssLight,
      cssDark: artifact.cssDark,
      assets: await this.resolveAssetUrls(version.assetManifest ?? {}),
      brand: {
        productName:
          (artifact.meta as { productName?: string }).productName ??
          this.distributionService.getDistributionArtifact().brand.productName,
        shortName:
          (artifact.meta as { shortName?: string }).shortName ??
          this.distributionService.getDistributionArtifact().brand.shortName,
      },
      meta: {
        adapterVersion: version.adapterVersion,
        source: 'workspace',
        publishedAt: version.createdAt.toISOString(),
      },
    };
  }

  // The published manifest pins assets by id+hash (doc 11 §5) — the URL is
  // rebuilt from the registry row so a missing/invalidated asset silently
  // drops out of the map instead of serving a dead link.
  private async resolveAssetUrls(
    manifest: ResolvedAssetMap,
  ): Promise<Record<string, O2dBrandingResolvedAsset>> {
    const references = Object.entries(manifest);

    if (references.length === 0) {
      return {};
    }

    const assets = await this.assetRepository.findBy({
      id: In(references.map(([, reference]) => reference.assetId)),
      status: O2dBrandingAssetStatus.VALID,
    });

    const resolvedAssets: Record<string, O2dBrandingResolvedAsset> = {};

    for (const [slot, reference] of references) {
      const asset = assets.find(
        (candidate) =>
          candidate.id === reference.assetId &&
          candidate.hash === reference.hash,
      );

      if (
        asset !== undefined &&
        asset.url !== null &&
        asset.url !== undefined
      ) {
        resolvedAssets[slot] = {
          url: asset.url,
          hash: asset.hash,
          format: asset.format,
        };
      }
    }

    return resolvedAssets;
  }
}
