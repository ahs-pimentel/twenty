import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import { O2dBrandingConfigurationStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import {
  O2dBrandingDistributionService,
  type O2dBrandingResolvedArtifact,
} from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';

// Workspace → published artifact resolution (docs 07 §3, 12). Domain-based
// resolution and the Redis cache layer arrive in phase 5; every failure
// path falls back to the distribution artifact — never a broken theme.
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
    private readonly distributionService: O2dBrandingDistributionService,
  ) {}

  async resolveByWorkspace(
    workspaceId: string,
  ): Promise<O2dBrandingResolvedArtifact> {
    try {
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
        brand: {
          productName:
            (artifact.meta as { productName?: string }).productName ??
            this.distributionService.getDistributionArtifact().brand
              .productName,
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
    } catch (error) {
      // Resolution must never break the client — degrade to the
      // distribution identity and report (doc 06 §4 behaviors).
      this.logger.warn(
        `branding resolution failed for workspace ${workspaceId}: ${error}`,
      );

      return this.distributionService.getDistributionArtifact();
    }
  }
}
