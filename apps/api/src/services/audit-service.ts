import type { FastifyRequest } from 'fastify';
import type { Database, Transaction } from '../database/client.js';
import type { AuthenticatedUser } from '../domain/types.js';

export type AuditRecord = {
  user: AuthenticatedUser | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  correlationId: string;
  sourceIp?: string;
  userAgent?: string;
  beforeState?: unknown;
  afterState?: unknown;
};

export function auditContext(request: FastifyRequest): Pick<AuditRecord, 'sourceIp' | 'userAgent'> {
  return {
    sourceIp: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

export class AuditService {
  constructor(private readonly database: Database) {}

  async record(record: AuditRecord, transaction?: Transaction): Promise<void> {
    const workspaceId = record.user?.workspaceId;
    if (!workspaceId) throw new Error('Audit record requires a workspace');

    const text = `INSERT INTO audit.audit_events (
         workspace_id, actor_user_id, actor_email, action, resource_type, resource_id,
         correlation_id, source_ip, user_agent, before_state, after_state
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, $8::inet, $9, $10::jsonb, $11::jsonb)`;
    const values = [
      workspaceId,
      record.user?.id ?? null,
      record.user?.email ?? null,
      record.action,
      record.resourceType,
      record.resourceId ?? null,
      record.correlationId,
      record.sourceIp ?? null,
      record.userAgent ?? null,
      record.beforeState === undefined ? null : JSON.stringify(record.beforeState),
      record.afterState === undefined ? null : JSON.stringify(record.afterState),
    ];
    if (transaction) await transaction.query(text, values);
    else await this.database.query(text, values);
  }
}
