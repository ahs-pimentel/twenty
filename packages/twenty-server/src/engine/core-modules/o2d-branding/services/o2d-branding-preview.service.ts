import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';
import {
  currentAdapter,
  validateBrandingConfig,
  type ResolvedAssetMap,
  type ValidationIssue,
} from 'o2d-branding-core';

import { O2dBrandingAssetEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-asset.entity';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingAssetStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { type O2dBrandingResolvedAsset } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';

export type O2dBrandingDraftPreview = {
  status: 'valid' | 'failed';
  issues: ValidationIssue[];
  artifact: {
    hash: string;
    cssLight: Record<string, string>;
    cssDark: Record<string, string>;
    brand: { productName: string; shortName: string };
    assets: Record<string, O2dBrandingResolvedAsset>;
  } | null;
};

// Draft preview (doc 14 §3): runs the same normalize → validate → adapter
// pipeline as publication but persists nothing — no version row, no cache
// entry, and the public endpoint never sees it (doc 12 §6). Scoping is the
// admin GraphQL guard itself (working decision OQ-08-1/13-1: the preview is
// applied client-side on the admin's own document, so no previewToken is
// minted — deviation from doc 14 §3 recorded in the PR).
@Injectable()
export class O2dBrandingPreviewService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async previewDraft(
    workspaceId: string,
    configurationId: string,
  ): Promise<O2dBrandingDraftPreview> {
    const configuration = await this.dataSource.manager.findOneBy(
      O2dBrandingConfigurationEntity,
      { id: configurationId, workspaceId },
    );

    if (configuration === null) {
      throw new NotFoundException('branding configuration not found');
    }

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
            message: 'configuration has no draft to preview',
          },
        ],
        artifact: null,
      };
    }

    const validation = validateBrandingConfig(configuration.draftConfig);
    const resolved = validation.normalization?.resolved ?? null;

    if (validation.status !== 'valid' || resolved === null) {
      return { status: 'failed', issues: validation.issues, artifact: null };
    }

    const overrides = currentAdapter.mapThemeTokens(resolved.tokens);

    return {
      status: 'valid',
      issues: validation.issues,
      artifact: {
        hash: resolved.meta.hash,
        cssLight: overrides.light,
        cssDark: overrides.dark,
        brand: {
          productName: configuration.draftConfig.brand.productName,
          shortName: configuration.draftConfig.brand.shortName,
        },
        assets: await this.resolveDraftAssetUrls(
          configuration.id,
          resolved.assets,
        ),
      },
    };
  }

  // Same id+hash pinning as the published manifest (doc 11 §5), but a
  // pending or stale ref silently drops out instead of blocking — the
  // preview should show work in progress, not gate it.
  private async resolveDraftAssetUrls(
    configurationId: string,
    manifest: ResolvedAssetMap,
  ): Promise<Record<string, O2dBrandingResolvedAsset>> {
    const resolvedAssets: Record<string, O2dBrandingResolvedAsset> = {};

    for (const [slot, reference] of Object.entries(manifest)) {
      const asset = await this.dataSource.manager.findOneBy(
        O2dBrandingAssetEntity,
        {
          id: reference.assetId,
          configurationId,
          hash: reference.hash,
          status: O2dBrandingAssetStatus.VALID,
        },
      );

      if (asset !== null && asset.url !== null && asset.url !== undefined) {
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
