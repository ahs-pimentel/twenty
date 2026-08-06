import { registerEnumType } from '@nestjs/graphql';

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
} from 'typeorm';

import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingDomainStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

registerEnumType(O2dBrandingDomainStatus, { name: 'O2dBrandingDomainStatus' });

// Domain → configuration mapping (doc 18 §o2dBrandingDomain). Domain
// resolution itself is phase 5; the table is part of o2d-branding-init.
// Hostnames are stored lowercased at the service layer (varchar, not citext,
// to avoid depending on the extension).
@Entity({ name: 'o2dBrandingDomain', schema: 'core' })
@Unique('UQ_O2D_BRANDING_DOMAIN_HOSTNAME', ['hostname'])
@Index('UQ_O2D_BRANDING_DOMAIN_PRIMARY', ['workspaceId'], {
  unique: true,
  where: '"isPrimary" = true',
})
export class O2dBrandingDomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'workspaceId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_DOMAIN_WORKSPACE',
  })
  workspace: Relation<WorkspaceEntity>;

  @Column()
  hostname: string;

  @Column({ type: 'uuid', nullable: true })
  configurationId?: string | null;

  @ManyToOne(() => O2dBrandingConfigurationEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'configurationId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_DOMAIN_CONFIGURATION',
  })
  configuration?: Relation<O2dBrandingConfigurationEntity> | null;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({
    type: 'enum',
    enum: Object.values(O2dBrandingDomainStatus),
    default: O2dBrandingDomainStatus.PENDING,
  })
  status: O2dBrandingDomainStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
