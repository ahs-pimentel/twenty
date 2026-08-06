import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceDomainsModule } from 'src/engine/core-modules/domain/workspace-domains/workspace-domains.module';
import { FileStorageModule } from 'src/engine/core-modules/file-storage/file-storage.module';
import { O2dBrandingPublicController } from 'src/engine/core-modules/o2d-branding/controllers/o2d-branding-public.controller';
import { O2dBrandingAssetEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-asset.entity';
import { O2dBrandingAuditEventEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-audit-event.entity';
import { O2dBrandingCompatibilityReportEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-compatibility-report.entity';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingDomainEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-domain.entity';
import { O2dBrandingPublicationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-publication.entity';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import { O2dBrandingResolver } from 'src/engine/core-modules/o2d-branding/resolvers/o2d-branding.resolver';
import { O2dBrandingAssetService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-asset.service';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';
import { O2dBrandingCacheService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-cache.service';
import { O2dBrandingValidationRunService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-validation-run.service';
import { O2dBrandingConfigurationService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-configuration.service';
import { O2dBrandingDistributionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';
import { O2dBrandingPublicationService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-publication.service';
import { O2dBrandingResolutionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-resolution.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';

// óDois branding engine server module (docs/specs/branding-engine 07/18/19).
// Additive: no existing table or file is modified besides the module
// registration in CoreEngineModule.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      O2dBrandingConfigurationEntity,
      O2dBrandingVersionEntity,
      O2dBrandingAssetEntity,
      O2dBrandingDomainEntity,
      O2dBrandingPublicationEntity,
      O2dBrandingAuditEventEntity,
      O2dBrandingCompatibilityReportEntity,
      WorkspaceEntity,
    ]),
    PermissionsModule,
    WorkspaceDomainsModule,
    FileStorageModule,
  ],
  controllers: [O2dBrandingPublicController],
  providers: [
    O2dBrandingAssetService,
    O2dBrandingAuditService,
    O2dBrandingCacheService,
    O2dBrandingConfigurationService,
    O2dBrandingDistributionService,
    O2dBrandingPublicationService,
    O2dBrandingResolutionService,
    O2dBrandingValidationRunService,
    O2dBrandingResolver,
  ],
  exports: [
    O2dBrandingResolutionService,
    O2dBrandingDistributionService,
    O2dBrandingValidationRunService,
  ],
})
export class O2dBrandingModule {}
