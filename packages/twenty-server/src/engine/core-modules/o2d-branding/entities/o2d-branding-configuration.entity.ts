import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { type O2DBrandingConfig } from 'o2d-branding-core';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { O2dBrandingConfigurationStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

registerEnumType(O2dBrandingConfigurationStatus, {
  name: 'O2dBrandingConfigurationStatus',
});

// Branding configuration per workspace (doc 18 §o2dBrandingConfiguration).
// Explicit FK constraint names keep entity and create-table instance command
// deterministic (same rationale as the dpa entity).
@Entity({ name: 'o2dBrandingConfiguration', schema: 'core' })
@Index('IDX_O2D_BRANDING_CONFIGURATION_WORKSPACE_ID', ['workspaceId'])
@Unique('UQ_O2D_BRANDING_CONFIGURATION_WORKSPACE_NAME', ['workspaceId', 'name'])
@ObjectType('O2dBrandingConfiguration')
export class O2dBrandingConfigurationEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field(() => O2dBrandingConfigurationStatus)
  @Column({
    type: 'enum',
    enum: Object.values(O2dBrandingConfigurationStatus),
    default: O2dBrandingConfigurationStatus.ACTIVE,
  })
  status: O2dBrandingConfigurationStatus;

  @Field(() => UUIDScalarType, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  publishedVersionId?: string | null;

  @ManyToOne(() => O2dBrandingVersionEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'publishedVersionId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_CONFIGURATION_PUBLISHED_VERSION',
  })
  publishedVersion?: Relation<O2dBrandingVersionEntity> | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  draftConfig?: O2DBrandingConfig | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  draftUpdatedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  draftUpdatedBy?: string | null;

  @Field()
  @Column({ default: 'o2d.branding.config/1-0-0' })
  schemaVersion: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'workspaceId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_CONFIGURATION_WORKSPACE',
  })
  workspace: Relation<WorkspaceEntity>;
}
