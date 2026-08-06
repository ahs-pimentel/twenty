import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Append-only audit trail (doc 18 §o2dBrandingAuditEvent, catalog doc 20).
// Written in the same transaction as the mutation (outbox); the application
// never updates or deletes rows.
@Entity({ name: 'o2dBrandingAuditEvent', schema: 'core' })
@Index('IDX_O2D_BRANDING_AUDIT_EVENT_CONFIGURATION_CREATED_AT', [
  'configurationId',
  'createdAt',
])
@Index('IDX_O2D_BRANDING_AUDIT_EVENT_CORRELATION_ID', ['correlationId'])
export class O2dBrandingAuditEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  configurationId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  versionId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string | null;

  @Column()
  eventType: string;

  @Column()
  actorType: string;

  @Column({ type: 'varchar', nullable: true })
  actorId?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: object;

  @Column({ type: 'uuid', nullable: true })
  correlationId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
