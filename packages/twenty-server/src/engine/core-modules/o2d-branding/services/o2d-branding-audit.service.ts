import { Injectable } from '@nestjs/common';

import { type EntityManager } from 'typeorm';

import { O2dBrandingAuditEventEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-audit-event.entity';

type AuditEventInput = {
  eventType: string;
  workspaceId?: string;
  configurationId?: string;
  versionId?: string;
  actorType: 'user' | 'system' | 'upstream-bridge';
  actorId?: string;
  payload?: object;
  correlationId?: string;
};

// Append-only audit trail written inside the mutation's transaction
// (outbox pattern — docs 18/20). The BullMQ fan-out for external consumers
// arrives with the async-validation increment.
@Injectable()
export class O2dBrandingAuditService {
  async record(
    entityManager: EntityManager,
    event: AuditEventInput,
  ): Promise<void> {
    await entityManager.insert(O2dBrandingAuditEventEntity, {
      eventType: event.eventType,
      workspaceId: event.workspaceId ?? null,
      configurationId: event.configurationId ?? null,
      versionId: event.versionId ?? null,
      actorType: event.actorType,
      actorId: event.actorId ?? null,
      payload: event.payload ?? {},
      correlationId: event.correlationId ?? null,
    });
  }
}
