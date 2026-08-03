import type { PoolClient } from 'pg';
import type { Database } from '../database/client.js';
import { transitionCall } from '../domain/call-state-machine.js';
import { automationMatches } from '../domain/automation-engine.js';
import { routeCall } from '../domain/routing-engine.js';
import type {
  AutomationCondition,
  CallStatus,
  ProviderWebhook,
  RoutingCandidate,
  RoutingDecision,
} from '../domain/types.js';
import { HttpError } from './http-error.js';
import type { RealtimeHub } from './realtime-hub.js';

type CallRow = {
  id: string;
  status: CallStatus;
  queue_id: string | null;
  assigned_agent_id: string | null;
};

type RuleRow = {
  id: string;
  conditions: AutomationCondition[];
};

export type WebhookResult = {
  duplicate: boolean;
  callId?: string;
  status?: CallStatus;
  routingDecision?: RoutingDecision | null;
};

const eventStatus: Record<ProviderWebhook['eventType'], CallStatus> = {
  CALL_RECEIVED: 'RECEIVED',
  CALL_QUEUED: 'QUEUED',
  AGENT_RINGING: 'RINGING',
  AGENT_ANSWERED: 'ACTIVE',
  CALL_ENDED: 'COMPLETED',
  CALL_ABANDONED: 'ABANDONED',
  CALL_FAILED: 'FAILED',
};

export class ProviderEventService {
  constructor(
    private readonly database: Database,
    private readonly realtimeHub: RealtimeHub,
  ) {}

  async process(
    workspaceSlug: string,
    webhook: ProviderWebhook,
    correlationId: string,
  ): Promise<WebhookResult> {
    const result = await this.database.transaction(async (client) => {
      const workspace = await client.query<{ id: string }>(
        'SELECT id FROM identity.workspaces WHERE slug = $1',
        [workspaceSlug],
      );
      const workspaceId = workspace.rows[0]?.id;
      if (!workspaceId) throw new HttpError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

      const inbox = await client.query(
        `INSERT INTO events.webhook_inbox (
           workspace_id, provider_event_id, event_type, payload
         ) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (workspace_id, provider_event_id) DO NOTHING
         RETURNING id`,
        [workspaceId, webhook.eventId, webhook.eventType, JSON.stringify(webhook)],
      );
      if (inbox.rowCount === 0) return { duplicate: true } satisfies WebhookResult;

      let call = await this.findCall(client, workspaceId, webhook.call.providerCallId);
      const previousStatus = call?.status ?? null;
      if (!call) {
        if (webhook.eventType !== 'CALL_RECEIVED') {
          throw new HttpError(
            409,
            'The first event for a provider call must be CALL_RECEIVED',
            'CALL_NOT_INITIALIZED',
          );
        }
        call = await this.createCall(client, workspaceId, webhook);
      } else if (webhook.eventType === 'CALL_RECEIVED') {
        throw new HttpError(
          409,
          'Call already exists with a different event id',
          'CALL_ALREADY_EXISTS',
        );
      } else {
        call = await this.applyEvent(client, workspaceId, call, webhook);
      }

      await this.insertCallEvent(client, workspaceId, call, webhook, previousStatus);

      let routingDecision: RoutingDecision | null | undefined;
      if (webhook.eventType === 'CALL_RECEIVED') {
        const routed = await this.routeReceivedCall(client, workspaceId, call, webhook);
        call = routed.call;
        routingDecision = routed.decision;
      }

      if (['CALL_ENDED', 'CALL_ABANDONED', 'CALL_FAILED'].includes(webhook.eventType)) {
        await this.scheduleAutomations(client, workspaceId, call, webhook);
      }

      await this.writeOutbox(client, workspaceId, call, webhook, correlationId, routingDecision);
      await client.query(
        `UPDATE events.webhook_inbox
         SET status = 'PROCESSED', processed_at = now()
         WHERE workspace_id = $1 AND provider_event_id = $2`,
        [workspaceId, webhook.eventId],
      );
      await client.query(
        `INSERT INTO audit.audit_events (
           workspace_id, actor_email, action, resource_type, resource_id, correlation_id, after_state
         ) VALUES ($1, 'provider:webhook', $2, 'call', $3, $4::uuid, $5::jsonb)`,
        [
          workspaceId,
          webhook.eventType,
          call.id,
          correlationId,
          JSON.stringify({ status: call.status }),
        ],
      );

      return {
        duplicate: false,
        callId: call.id,
        status: call.status,
        routingDecision,
      } satisfies WebhookResult;
    });

    if (!result.duplicate) {
      try {
        await this.realtimeHub.publish({
          type: 'CALL_UPDATED',
          occurredAt: new Date().toISOString(),
          payload: result,
        });
      } catch {
        // Realtime fan-out is best effort; PostgreSQL remains authoritative.
      }
    }
    return result;
  }

  private async findCall(client: PoolClient, workspaceId: string, providerCallId: string) {
    const result = await client.query<CallRow>(
      `SELECT id, status, queue_id, assigned_agent_id
       FROM calls.call_sessions
       WHERE workspace_id = $1 AND provider_call_id = $2
       FOR UPDATE`,
      [workspaceId, providerCallId],
    );
    return result.rows[0] ?? null;
  }

  private async resolveQueue(client: PoolClient, workspaceId: string, queueKey?: string) {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM routing.queues
       WHERE workspace_id = $1 AND key = coalesce($2, 'customer-care') AND enabled`,
      [workspaceId, queueKey ?? null],
    );
    if (!result.rows[0])
      throw new HttpError(422, 'Provider queue is not configured', 'QUEUE_NOT_FOUND');
    return result.rows[0].id;
  }

  private async createCall(
    client: PoolClient,
    workspaceId: string,
    webhook: ProviderWebhook,
  ): Promise<CallRow> {
    const queueId = await this.resolveQueue(client, workspaceId, webhook.call.queueKey);
    const result = await client.query<CallRow>(
      `INSERT INTO calls.call_sessions (
         workspace_id, provider_call_id, queue_id, direction, status, caller_number,
         destination_number, started_at, provider_metadata
       ) VALUES ($1, $2, $3, $4::calls.call_direction, 'RECEIVED', $5, $6, $7, $8::jsonb)
       RETURNING id, status, queue_id, assigned_agent_id`,
      [
        workspaceId,
        webhook.call.providerCallId,
        queueId,
        webhook.call.direction,
        webhook.call.from,
        webhook.call.to,
        webhook.occurredAt,
        JSON.stringify(webhook.metadata ?? {}),
      ],
    );
    return result.rows[0] as CallRow;
  }

  private async applyEvent(
    client: PoolClient,
    workspaceId: string,
    call: CallRow,
    webhook: ProviderWebhook,
  ): Promise<CallRow> {
    const nextStatus = transitionCall(call.status, eventStatus[webhook.eventType]);
    let agentId = call.assigned_agent_id;

    if (webhook.call.agentExternalId) {
      const agent = await client.query<{ id: string }>(
        `SELECT id FROM routing.agents
         WHERE workspace_id = $1 AND external_id = $2 AND enabled`,
        [workspaceId, webhook.call.agentExternalId],
      );
      if (!agent.rows[0])
        throw new HttpError(422, 'Provider agent is not configured', 'AGENT_NOT_FOUND');
      if (call.assigned_agent_id && call.assigned_agent_id !== agent.rows[0].id) {
        await client.query(
          `UPDATE routing.agents
           SET presence = 'AVAILABLE', last_presence_change_at = now()
           WHERE id = $1 AND workspace_id = $2 AND presence = 'RESERVED'`,
          [call.assigned_agent_id, workspaceId],
        );
      }
      agentId = agent.rows[0].id;
    }

    if (webhook.eventType === 'AGENT_RINGING' && agentId) {
      await client.query(
        `UPDATE routing.agents SET presence = 'RESERVED', last_presence_change_at = now()
         WHERE id = $1 AND workspace_id = $2`,
        [agentId, workspaceId],
      );
    }
    if (webhook.eventType === 'AGENT_ANSWERED' && agentId) {
      await client.query(
        `UPDATE routing.agents
         SET presence = 'ON_CALL', active_call_count = active_call_count + 1,
             last_presence_change_at = now()
         WHERE id = $1 AND workspace_id = $2`,
        [agentId, workspaceId],
      );
    }
    if (webhook.eventType === 'CALL_QUEUED' && agentId) {
      await client.query(
        `UPDATE routing.agents
         SET presence = 'AVAILABLE', last_presence_change_at = now()
         WHERE id = $1 AND workspace_id = $2 AND presence = 'RESERVED'`,
        [agentId, workspaceId],
      );
      agentId = null;
    }
    if (['CALL_ENDED', 'CALL_ABANDONED', 'CALL_FAILED'].includes(webhook.eventType) && agentId) {
      await client.query(
        `UPDATE routing.agents
         SET presence = CASE WHEN active_call_count > 0 THEN 'WRAP_UP'::routing.agent_presence
                             ELSE 'AVAILABLE'::routing.agent_presence END,
             active_call_count = greatest(active_call_count - 1, 0),
             last_presence_change_at = now()
         WHERE id = $1 AND workspace_id = $2`,
        [agentId, workspaceId],
      );
    }

    const result = await client.query<CallRow>(
      `UPDATE calls.call_sessions
       SET status = $3::calls.call_status,
           assigned_agent_id = CASE WHEN $7 = 'CALL_QUEUED' THEN NULL
                                    ELSE coalesce($4, assigned_agent_id) END,
           answered_at = CASE WHEN $3 = 'ACTIVE' THEN coalesce(answered_at, $5::timestamptz) ELSE answered_at END,
           ended_at = CASE WHEN $3 IN ('COMPLETED','ABANDONED','FAILED') THEN $5::timestamptz ELSE ended_at END,
           ended_reason = coalesce($6, ended_reason),
           version = version + 1
       WHERE id = $1 AND workspace_id = $2
       RETURNING id, status, queue_id, assigned_agent_id`,
      [
        call.id,
        workspaceId,
        nextStatus,
        agentId,
        webhook.occurredAt,
        webhook.call.endedReason ?? null,
        webhook.eventType,
      ],
    );
    return result.rows[0] as CallRow;
  }

  private async insertCallEvent(
    client: PoolClient,
    workspaceId: string,
    call: CallRow,
    webhook: ProviderWebhook,
    previousStatus: CallStatus | null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO calls.call_events (
         workspace_id, call_id, provider_event_id, event_type, previous_status,
         current_status, payload, occurred_at
       ) VALUES ($1, $2, $3, $4, $5::calls.call_status, $6::calls.call_status, $7::jsonb, $8)`,
      [
        workspaceId,
        call.id,
        webhook.eventId,
        webhook.eventType,
        previousStatus,
        call.status,
        JSON.stringify(webhook),
        webhook.occurredAt,
      ],
    );
  }

  private async routeReceivedCall(
    client: PoolClient,
    workspaceId: string,
    call: CallRow,
    webhook: ProviderWebhook,
  ): Promise<{ call: CallRow; decision: RoutingDecision | null }> {
    const skills = await client.query<{ key: string; required: boolean }>(
      `SELECT s.key, qs.required
       FROM routing.queue_skills qs JOIN routing.skills s ON s.id = qs.skill_id
       WHERE qs.queue_id = $1`,
      [call.queue_id],
    );
    const candidates = await client.query<{
      id: string;
      display_name: string;
      presence: RoutingCandidate['presence'];
      skills: string[];
      last_assigned_at: Date | null;
      active_call_count: number;
      max_concurrent_calls: number;
    }>(
      `SELECT a.id, a.display_name, a.presence,
              coalesce((
                SELECT array_agg(DISTINCT s.key)
                FROM routing.agent_skills ask
                JOIN routing.skills s ON s.id = ask.skill_id
                WHERE ask.agent_id = a.id
              ), '{}') AS skills,
              a.last_assigned_at, a.active_call_count::int, a.max_concurrent_calls::int
       FROM routing.queue_members qm
       JOIN routing.agents a ON a.id = qm.agent_id
       WHERE qm.queue_id = $1 AND a.workspace_id = $2 AND a.enabled
         AND a.presence = 'AVAILABLE'
         AND a.active_call_count < a.max_concurrent_calls
       FOR UPDATE OF a SKIP LOCKED`,
      [call.queue_id, workspaceId],
    );

    const decision = routeCall(
      {
        requiredSkills: skills.rows.filter((skill) => skill.required).map((skill) => skill.key),
        preferredSkills: skills.rows.filter((skill) => !skill.required).map((skill) => skill.key),
      },
      candidates.rows.map((candidate) => ({
        id: candidate.id,
        displayName: candidate.display_name,
        presence: candidate.presence,
        skills: candidate.skills,
        lastAssignedAt: candidate.last_assigned_at,
        activeCallCount: candidate.active_call_count,
        maxConcurrentCalls: candidate.max_concurrent_calls,
      })),
    );

    const previousStatus = call.status;
    const nextStatus: CallStatus = decision ? 'ROUTING' : 'QUEUED';
    const updated = await client.query<CallRow>(
      `UPDATE calls.call_sessions
       SET status = $3::calls.call_status, assigned_agent_id = $4,
           version = version + 1
       WHERE id = $1 AND workspace_id = $2
       RETURNING id, status, queue_id, assigned_agent_id`,
      [call.id, workspaceId, nextStatus, decision?.agentId ?? null],
    );
    if (decision) {
      const reservation = await client.query(
        `UPDATE routing.agents
         SET presence = 'RESERVED', last_assigned_at = now(), last_presence_change_at = now()
         WHERE id = $1 AND presence = 'AVAILABLE'`,
        [decision.agentId],
      );
      if (reservation.rowCount !== 1) {
        throw new Error('Selected agent could not be reserved');
      }
    }

    const routedCall = updated.rows[0] as CallRow;
    await client.query(
      `INSERT INTO calls.call_events (
         workspace_id, call_id, event_type, previous_status, current_status, payload, occurred_at
       ) VALUES ($1, $2, $3, $4::calls.call_status, $5::calls.call_status, $6::jsonb, $7)`,
      [
        workspaceId,
        call.id,
        decision ? 'ROUTING_DECISION' : 'ROUTING_DEFERRED',
        previousStatus,
        nextStatus,
        JSON.stringify({ decision, queueKey: webhook.call.queueKey ?? 'customer-care' }),
        webhook.occurredAt,
      ],
    );
    return { call: routedCall, decision };
  }

  private async scheduleAutomations(
    client: PoolClient,
    workspaceId: string,
    call: CallRow,
    webhook: ProviderWebhook,
  ): Promise<void> {
    const rules = await client.query<RuleRow>(
      `SELECT id, conditions FROM automation.rules
       WHERE workspace_id = $1 AND trigger_event = $2 AND enabled`,
      [workspaceId, webhook.eventType],
    );
    for (const rule of rules.rows) {
      if (!automationMatches(rule.conditions, webhook, call.status)) continue;
      await client.query(
        `INSERT INTO automation.runs (workspace_id, rule_id, call_id, input)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [workspaceId, rule.id, call.id, JSON.stringify({ webhook, status: call.status })],
      );
    }
  }

  private async writeOutbox(
    client: PoolClient,
    workspaceId: string,
    call: CallRow,
    webhook: ProviderWebhook,
    correlationId: string,
    routingDecision?: RoutingDecision | null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO events.outbox_events (
         workspace_id, aggregate_type, aggregate_id, event_type, correlation_id, payload
       ) VALUES ($1, 'call', $2, $3, $4::uuid, $5::jsonb)`,
      [
        workspaceId,
        call.id,
        `call.${webhook.eventType.toLowerCase()}`,
        correlationId,
        JSON.stringify({
          providerEventId: webhook.eventId,
          providerCallId: webhook.call.providerCallId,
          status: call.status,
          routingDecision: routingDecision ?? null,
        }),
      ],
    );
  }
}
