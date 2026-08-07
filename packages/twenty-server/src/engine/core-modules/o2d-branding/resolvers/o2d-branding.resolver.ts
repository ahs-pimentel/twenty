import { UseFilters, UseGuards } from '@nestjs/common';
import {
  Args,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
} from '@nestjs/graphql';

import GraphQLJSON from 'graphql-type-json';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import type { FileUpload } from 'graphql-upload/processRequest.mjs';
import { PermissionFlagType } from 'twenty-shared/constants';
import { canonicalHash, type O2DBrandingConfig } from 'o2d-branding-core';

import { CoreResolver } from 'src/engine/api/graphql/graphql-config/decorators/core-resolver.decorator';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { O2dBrandingAssetEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-asset.entity';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import { O2dBrandingDraftPreviewDTO } from 'src/engine/core-modules/o2d-branding/dtos/o2d-branding-draft-preview.dto';
import { O2dBrandingValidationResultDTO } from 'src/engine/core-modules/o2d-branding/dtos/o2d-branding-validation-result.dto';
import { O2dBrandingValidationRunDTO } from 'src/engine/core-modules/o2d-branding/dtos/o2d-branding-validation-run.dto';
import { O2dBrandingVersionDiffDTO } from 'src/engine/core-modules/o2d-branding/dtos/o2d-branding-version-diff.dto';
import { O2dBrandingDomainEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-domain.entity';
import { O2dBrandingAssetService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-asset.service';
import { O2dBrandingConfigurationService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-configuration.service';
import { O2dBrandingDomainService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-domain.service';
import { O2dBrandingPreviewService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-preview.service';
import { O2dBrandingPublicationService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-publication.service';
import { O2dBrandingValidationRunService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-validation-run.service';
import { O2dBrandingVersionDiffService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-version-diff.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { streamToBuffer } from 'src/utils/stream-to-buffer';

// Admin surface (working decision OQ-19-1: GraphQL for admin, REST for the
// public runtime). MVP RBAC reuses the WORKSPACE settings flag (doc 17 §1);
// a dedicated BRANDING flag is the phase 4 evolution.
@CoreResolver(() => O2dBrandingConfigurationEntity)
@UseFilters(AuthGraphqlApiExceptionFilter, PermissionsGraphqlApiExceptionFilter)
@UseGuards(
  WorkspaceAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.WORKSPACE),
)
export class O2dBrandingResolver {
  constructor(
    private readonly configurationService: O2dBrandingConfigurationService,
    private readonly publicationService: O2dBrandingPublicationService,
    private readonly assetService: O2dBrandingAssetService,
    private readonly validationRunService: O2dBrandingValidationRunService,
    private readonly previewService: O2dBrandingPreviewService,
    private readonly versionDiffService: O2dBrandingVersionDiffService,
    private readonly domainService: O2dBrandingDomainService,
  ) {}

  // Domain → configuration mapping (doc 12): which branding each host
  // serves. Routing/DNS stay with the existing custom-domain machinery.
  @Query(() => [O2dBrandingDomainEntity])
  async o2dBrandingDomains(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<O2dBrandingDomainEntity[]> {
    return this.domainService.listForWorkspace(workspace.id);
  }

  @Mutation(() => O2dBrandingDomainEntity)
  async upsertO2dBrandingDomain(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('hostname') hostname: string,
    @Args('configurationId', {
      type: () => UUIDScalarType,
      nullable: true,
    })
    configurationId?: string,
  ): Promise<O2dBrandingDomainEntity> {
    return this.domainService.upsert(workspace.id, user.id, {
      hostname,
      configurationId: configurationId ?? null,
    });
  }

  @Mutation(() => Boolean)
  async removeO2dBrandingDomain(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('hostname') hostname: string,
  ): Promise<boolean> {
    return this.domainService.remove(workspace.id, user.id, hostname);
  }

  // Canonical hash of the current draft — lets the client derive the doc 15
  // draft state machine (READY_TO_PUBLISH when it matches a completed valid
  // validation run; any edit changes the hash and demotes back to DRAFT).
  @ResolveField(() => String, { nullable: true })
  draftHash(
    @Parent() configuration: O2dBrandingConfigurationEntity,
  ): string | null {
    return configuration.draftConfig !== null &&
      configuration.draftConfig !== undefined
      ? canonicalHash(configuration.draftConfig)
      : null;
  }

  @Query(() => [O2dBrandingConfigurationEntity])
  async o2dBrandingConfigurations(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<O2dBrandingConfigurationEntity[]> {
    return this.configurationService.listForWorkspace(workspace.id);
  }

  @Query(() => O2dBrandingConfigurationEntity)
  async o2dBrandingConfiguration(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
  ): Promise<O2dBrandingConfigurationEntity> {
    return this.configurationService.getForWorkspace(workspace.id, id);
  }

  @Query(() => [O2dBrandingVersionEntity])
  async o2dBrandingVersions(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('configurationId', { type: () => UUIDScalarType })
    configurationId: string,
  ): Promise<O2dBrandingVersionEntity[]> {
    return this.publicationService.listVersions(workspace.id, configurationId);
  }

  @Mutation(() => O2dBrandingConfigurationEntity)
  async createO2dBrandingConfiguration(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('name') name: string,
    @Args('basePreset') basePreset: string,
  ): Promise<O2dBrandingConfigurationEntity> {
    return this.configurationService.create(workspace.id, user.id, {
      name,
      basePreset,
    });
  }

  @Mutation(() => O2dBrandingConfigurationEntity)
  async updateO2dBrandingDraft(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
    @Args('draftConfig', { type: () => GraphQLJSON })
    draftConfig: O2DBrandingConfig,
    @Args('expectedDraftUpdatedAt', { nullable: true })
    expectedDraftUpdatedAt?: Date,
  ): Promise<O2dBrandingConfigurationEntity> {
    return this.configurationService.updateDraft(
      workspace.id,
      user.id,
      id,
      draftConfig,
      expectedDraftUpdatedAt,
    );
  }

  @Mutation(() => O2dBrandingValidationResultDTO)
  async validateO2dBrandingDraft(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
  ): Promise<O2dBrandingValidationResultDTO> {
    return this.publicationService.validateDraft(workspace.id, id);
  }

  @Mutation(() => O2dBrandingVersionEntity)
  async publishO2dBrandingConfiguration(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
    @Args('changelog', { nullable: true }) changelog?: string,
  ): Promise<O2dBrandingVersionEntity> {
    return this.publicationService.publish(
      workspace.id,
      user.id,
      id,
      changelog,
    );
  }

  // Async validation (doc 19): answers immediately with the run
  // descriptor; the worker fills in the result, polled via the query below.
  @Mutation(() => O2dBrandingValidationRunDTO)
  async startO2dBrandingDraftValidation(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
  ): Promise<O2dBrandingValidationRunDTO> {
    return this.validationRunService.start(workspace.id, user.id, id);
  }

  @Query(() => O2dBrandingValidationRunDTO, { nullable: true })
  async o2dBrandingValidationRun(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('configurationId', { type: () => UUIDScalarType })
    configurationId: string,
  ): Promise<O2dBrandingValidationRunDTO | null> {
    return this.validationRunService.getRun(workspace.id, configurationId);
  }

  @Query(() => [O2dBrandingAssetEntity])
  async o2dBrandingAssets(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('configurationId', { type: () => UUIDScalarType })
    configurationId: string,
  ): Promise<O2dBrandingAssetEntity[]> {
    return this.assetService.listAssets(workspace.id, configurationId);
  }

  @Mutation(() => O2dBrandingAssetEntity)
  async uploadO2dBrandingAsset(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('configurationId', { type: () => UUIDScalarType })
    configurationId: string,
    @Args('slot') slot: string,
    @Args({ name: 'file', type: () => GraphQLUpload })
    { createReadStream, filename }: FileUpload,
  ): Promise<O2dBrandingAssetEntity> {
    // The pipeline enforces its own per-format ceilings (doc 11 §2); 5 MB
    // caps the raw stream before any inspection happens.
    const file = await streamToBuffer(createReadStream(), 5 * 1024 * 1024);

    return this.assetService.uploadAsset({
      workspaceId: workspace.id,
      userId: user.id,
      configurationId,
      slot,
      filename,
      file,
    });
  }

  // Draft preview (doc 14): ephemeral artifact, applied client-side on the
  // admin's own document — never persisted nor served publicly.
  @Query(() => O2dBrandingDraftPreviewDTO)
  async previewO2dBrandingDraft(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('configurationId', { type: () => UUIDScalarType })
    configurationId: string,
  ): Promise<O2dBrandingDraftPreviewDTO> {
    return this.previewService.previewDraft(workspace.id, configurationId);
  }

  @Query(() => O2dBrandingVersionDiffDTO)
  async o2dBrandingVersionDiff(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('configurationId', { type: () => UUIDScalarType })
    configurationId: string,
    @Args('fromNumber', { type: () => Int }) fromNumber: number,
    @Args('toNumber', { type: () => Int }) toNumber: number,
  ): Promise<O2dBrandingVersionDiffDTO> {
    return this.versionDiffService.getVersionDiff(
      workspace.id,
      configurationId,
      fromNumber,
      toNumber,
    );
  }

  @Mutation(() => O2dBrandingConfigurationEntity)
  async restoreO2dBrandingVersionAsDraft(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
    @Args('versionNumber', { type: () => Int }) versionNumber: number,
  ): Promise<O2dBrandingConfigurationEntity> {
    return this.publicationService.restoreVersionAsDraft(
      workspace.id,
      user.id,
      id,
      versionNumber,
    );
  }

  @Mutation(() => O2dBrandingVersionEntity)
  async rollbackO2dBrandingConfiguration(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
    @Args('toVersion', { type: () => Int }) toVersion: number,
    @Args('reason') reason: string,
  ): Promise<O2dBrandingVersionEntity> {
    return this.publicationService.rollback(
      workspace.id,
      user.id,
      id,
      toVersion,
      reason,
    );
  }
}
