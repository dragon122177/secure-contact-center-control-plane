import type { Database, Transaction } from '../database/client.js';
import { isNetworkAccessAllowed } from '../domain/network-policy.js';
import type { AgentPresence, AutomationAction, AutomationCondition } from '../domain/types.js';
import { HttpError } from './http-error.js';

type NetworkPolicyRow = {
  id: string;
  name: string;
  provider_name: string;
  access_type: 'VPN' | 'PROXY' | 'DIRECT';
  allowed_cidrs: string[];
  require_managed_device: boolean;
  enabled: boolean;
  notes: string;
  created_at: string;
};

export class ControlPlaneRepository {
  constructor(private readonly database: Database) {}

  async dashboard(workspaceId: string) {
    const [agents, calls, queues, automations, recentActivity] = await Promise.all([
      this.database.query<{
        total: number;
        available: number;
        on_call: number;
        offline: number;
      }>(
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE presence = 'AVAILABLE')::int AS available,
           count(*) FILTER (WHERE presence = 'ON_CALL')::int AS on_call,
           count(*) FILTER (WHERE presence = 'OFFLINE')::int AS offline
         FROM routing.agents WHERE workspace_id = $1 AND enabled`,
        [workspaceId],
      ),
      this.database.query<{
        active: number;
        waiting: number;
        completed_today: number;
        abandoned_today: number;
      }>(
        `SELECT
           count(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
           count(*) FILTER (WHERE status IN ('RECEIVED','QUEUED','ROUTING','RINGING'))::int AS waiting,
           count(*) FILTER (WHERE status = 'COMPLETED' AND started_at >= date_trunc('day', now()))::int AS completed_today,
           count(*) FILTER (WHERE status = 'ABANDONED' AND started_at >= date_trunc('day', now()))::int AS abandoned_today
         FROM calls.call_sessions WHERE workspace_id = $1`,
        [workspaceId],
      ),
      this.database.query(
        `SELECT queue_id AS "queueId", queue_key AS "queueKey", display_name AS "displayName",
                waiting_calls::int AS "waitingCalls", active_calls::int AS "activeCalls",
                average_wait_seconds::int AS "averageWaitSeconds"
         FROM calls.live_queue_metrics WHERE workspace_id = $1 ORDER BY display_name`,
        [workspaceId],
      ),
      this.database.query<{ pending: number; failed: number }>(
        `SELECT
           count(*) FILTER (WHERE status IN ('PENDING','RUNNING'))::int AS pending,
           count(*) FILTER (WHERE status = 'FAILED')::int AS failed
         FROM automation.runs WHERE workspace_id = $1`,
        [workspaceId],
      ),
      this.database.query(
        `SELECT id, action, resource_type AS "resourceType", resource_id AS "resourceId",
                actor_email AS "actorEmail", occurred_at AS "occurredAt"
         FROM audit.audit_events WHERE workspace_id = $1
         ORDER BY occurred_at DESC LIMIT 8`,
        [workspaceId],
      ),
    ]);

    return {
      agents: agents.rows[0] ?? { total: 0, available: 0, on_call: 0, offline: 0 },
      calls: calls.rows[0] ?? { active: 0, waiting: 0, completed_today: 0, abandoned_today: 0 },
      queues: queues.rows,
      automations: automations.rows[0] ?? { pending: 0, failed: 0 },
      recentActivity: recentActivity.rows,
      generatedAt: new Date().toISOString(),
    };
  }

  async listAgents(workspaceId: string) {
    const result = await this.database.query(
      `SELECT
         a.id,
         a.external_id AS "externalId",
         a.display_name AS "displayName",
         a.extension,
         a.presence,
         a.active_call_count::int AS "activeCallCount",
         a.max_concurrent_calls::int AS "maxConcurrentCalls",
         a.last_assigned_at AS "lastAssignedAt",
         a.last_presence_change_at AS "lastPresenceChangeAt",
         t.display_name AS "teamName",
         coalesce(jsonb_agg(DISTINCT s.key) FILTER (WHERE s.key IS NOT NULL), '[]'::jsonb) AS skills
       FROM routing.agents a
       LEFT JOIN routing.teams t ON t.id = a.team_id
       LEFT JOIN routing.agent_skills ask ON ask.agent_id = a.id
       LEFT JOIN routing.skills s ON s.id = ask.skill_id
       WHERE a.workspace_id = $1 AND a.enabled
       GROUP BY a.id, t.display_name
       ORDER BY a.display_name`,
      [workspaceId],
    );
    return result.rows;
  }

  async updateAgentPresence(
    workspaceId: string,
    agentId: string,
    presence: AgentPresence,
    onUpdated?: (
      transaction: Transaction,
      change: { before: unknown; after: unknown },
    ) => Promise<void>,
  ) {
    return this.database.transaction(async (client) => {
      const before = await client.query(
        `SELECT id, display_name AS "displayName", presence
         FROM routing.agents WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [agentId, workspaceId],
      );
      if (!before.rows[0]) throw new HttpError(404, 'Agent not found', 'AGENT_NOT_FOUND');

      if (
        presence === 'AVAILABLE' &&
        ['ON_CALL', 'RESERVED'].includes(String(before.rows[0].presence))
      ) {
        throw new HttpError(
          409,
          'An active or reserved call must be released before making this agent available',
          'AGENT_HAS_ACTIVE_WORK',
        );
      }

      const updated = await client.query(
        `UPDATE routing.agents
         SET presence = $3::routing.agent_presence, last_presence_change_at = now()
         WHERE id = $1 AND workspace_id = $2
         RETURNING id, display_name AS "displayName", presence,
                   last_presence_change_at AS "lastPresenceChangeAt"`,
        [agentId, workspaceId, presence],
      );
      const change = { before: before.rows[0], after: updated.rows[0] };
      await onUpdated?.(client, change);
      return change;
    });
  }

  async listQueues(workspaceId: string) {
    const result = await this.database.query(
      `SELECT
         q.id,
         q.key,
         q.display_name AS "displayName",
         q.description,
         q.service_level_seconds AS "serviceLevelSeconds",
         q.max_wait_seconds AS "maxWaitSeconds",
         q.enabled,
         count(DISTINCT qm.agent_id)::int AS "memberCount",
         count(DISTINCT qm.agent_id) FILTER (WHERE a.presence = 'AVAILABLE')::int AS "availableAgents",
         coalesce(jsonb_agg(DISTINCT s.key) FILTER (WHERE s.key IS NOT NULL), '[]'::jsonb) AS "requiredSkills",
         coalesce(m.waiting_calls, 0)::int AS "waitingCalls",
         coalesce(m.active_calls, 0)::int AS "activeCalls",
         coalesce(m.average_wait_seconds, 0)::int AS "averageWaitSeconds"
       FROM routing.queues q
       LEFT JOIN routing.queue_members qm ON qm.queue_id = q.id
       LEFT JOIN routing.agents a ON a.id = qm.agent_id
       LEFT JOIN routing.queue_skills qs ON qs.queue_id = q.id AND qs.required
       LEFT JOIN routing.skills s ON s.id = qs.skill_id
       LEFT JOIN calls.live_queue_metrics m ON m.queue_id = q.id
       WHERE q.workspace_id = $1
       GROUP BY q.id, m.waiting_calls, m.active_calls, m.average_wait_seconds
       ORDER BY q.display_name`,
      [workspaceId],
    );
    return result.rows;
  }

  async listCalls(workspaceId: string, status: string | undefined, limit: number, offset: number) {
    const result = await this.database.query(
      `SELECT
         c.id,
         c.provider_call_id AS "providerCallId",
         c.direction,
         c.status,
         c.caller_number AS "callerNumber",
         c.destination_number AS "destinationNumber",
         c.started_at AS "startedAt",
         c.answered_at AS "answeredAt",
         c.ended_at AS "endedAt",
         c.ended_reason AS "endedReason",
         c.disposition,
         c.tags,
         q.display_name AS "queueName",
         a.display_name AS "agentName",
         count(*) OVER()::int AS "totalCount"
       FROM calls.call_sessions c
       LEFT JOIN routing.queues q ON q.id = c.queue_id
       LEFT JOIN routing.agents a ON a.id = c.assigned_agent_id
       WHERE c.workspace_id = $1
         AND ($2::text IS NULL OR c.status::text = $2)
       ORDER BY c.started_at DESC
       LIMIT $3 OFFSET $4`,
      [workspaceId, status ?? null, limit, offset],
    );
    return {
      items: result.rows.map(({ totalCount: _totalCount, ...row }) => row),
      total: Number(result.rows[0]?.totalCount ?? 0),
      limit,
      offset,
    };
  }

  async callEvents(workspaceId: string, callId: string) {
    const call = await this.database.query(
      'SELECT id FROM calls.call_sessions WHERE id = $1 AND workspace_id = $2',
      [callId, workspaceId],
    );
    if (!call.rows[0]) throw new HttpError(404, 'Call not found', 'CALL_NOT_FOUND');

    const result = await this.database.query(
      `SELECT id, event_type AS "eventType", previous_status AS "previousStatus",
              current_status AS "currentStatus", payload, occurred_at AS "occurredAt",
              ingested_at AS "ingestedAt"
       FROM calls.call_events WHERE call_id = $1 ORDER BY occurred_at, ingested_at`,
      [callId],
    );
    return result.rows;
  }

  async listAutomationRules(workspaceId: string) {
    const result = await this.database.query(
      `SELECT id, name, description, trigger_event AS "triggerEvent", conditions, actions,
              enabled, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM automation.rules WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId],
    );
    return result.rows;
  }

  async createAutomationRule(input: {
    workspaceId: string;
    userId: string;
    name: string;
    description: string;
    triggerEvent: string;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  }) {
    const result = await this.database.query(
      `INSERT INTO automation.rules (
         workspace_id, name, description, trigger_event, conditions, actions, created_by
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       RETURNING id, name, description, trigger_event AS "triggerEvent", conditions, actions,
                 enabled, created_at AS "createdAt"`,
      [
        input.workspaceId,
        input.name,
        input.description,
        input.triggerEvent,
        JSON.stringify(input.conditions),
        JSON.stringify(input.actions),
        input.userId,
      ],
    );
    return result.rows[0];
  }

  async listAutomationRuns(workspaceId: string, limit: number) {
    const result = await this.database.query(
      `SELECT r.id, r.status, r.attempt_count AS "attemptCount", r.input, r.result,
              r.last_error AS "lastError", r.scheduled_at AS "scheduledAt",
              r.finished_at AS "finishedAt", rules.name AS "ruleName",
              c.provider_call_id AS "providerCallId"
       FROM automation.runs r
       JOIN automation.rules rules ON rules.id = r.rule_id
       LEFT JOIN calls.call_sessions c ON c.id = r.call_id
       WHERE r.workspace_id = $1 ORDER BY r.created_at DESC LIMIT $2`,
      [workspaceId, limit],
    );
    return result.rows;
  }

  async listNetworkPolicies(workspaceId: string) {
    const result = await this.database.query<NetworkPolicyRow>(
      `SELECT id, name, provider_name, access_type, allowed_cidrs::text[],
              require_managed_device, enabled, notes, created_at
       FROM security.network_policies WHERE workspace_id = $1 ORDER BY name`,
      [workspaceId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      providerName: row.provider_name,
      accessType: row.access_type,
      allowedCidrs: row.allowed_cidrs,
      requireManagedDevice: row.require_managed_device,
      enabled: row.enabled,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  }

  async validateNetworkSession(input: {
    workspaceId: string;
    agentId: string;
    sourceIp: string;
    deviceId?: string;
    managedDevice: boolean;
  }) {
    const agent = await this.database.query(
      'SELECT id FROM routing.agents WHERE id = $1 AND workspace_id = $2 AND enabled',
      [input.agentId, input.workspaceId],
    );
    if (!agent.rows[0]) throw new HttpError(404, 'Agent not found', 'AGENT_NOT_FOUND');

    const policies = await this.listNetworkPolicies(input.workspaceId);
    const matchingPolicy = policies.find(
      (policy) =>
        policy.enabled &&
        (!policy.requireManagedDevice || input.managedDevice) &&
        isNetworkAccessAllowed(input.sourceIp, policy.allowedCidrs),
    );
    const decision = matchingPolicy ? 'ALLOW' : 'DENY';
    const reason = matchingPolicy
      ? `Matched ${matchingPolicy.name}`
      : 'No enabled policy matched the source network and device posture';

    const inserted = await this.database.query<{
      id: string;
      decision: 'ALLOW' | 'DENY';
      reason: string;
      connectedAt: string;
    }>(
      `INSERT INTO security.agent_network_sessions (
         workspace_id, agent_id, policy_id, source_ip, device_id, decision, reason
       ) VALUES ($1, $2, $3, $4::inet, $5, $6, $7)
       RETURNING id, decision, reason, connected_at AS "connectedAt"`,
      [
        input.workspaceId,
        input.agentId,
        matchingPolicy?.id ?? null,
        input.sourceIp,
        input.deviceId ?? null,
        decision,
        reason,
      ],
    );
    const session = inserted.rows[0];
    if (!session) throw new Error('Network session insert did not return a row');
    return { ...session, policy: matchingPolicy ?? null };
  }

  async listNetworkSessions(workspaceId: string, limit: number) {
    const result = await this.database.query(
      `SELECT s.id, s.source_ip::text AS "sourceIp", s.device_id AS "deviceId",
              s.decision, s.reason, s.connected_at AS "connectedAt",
              a.display_name AS "agentName", p.name AS "policyName"
       FROM security.agent_network_sessions s
       JOIN routing.agents a ON a.id = s.agent_id
       LEFT JOIN security.network_policies p ON p.id = s.policy_id
       WHERE s.workspace_id = $1 ORDER BY s.connected_at DESC LIMIT $2`,
      [workspaceId, limit],
    );
    return result.rows;
  }

  async listAuditEvents(workspaceId: string, limit: number, action?: string) {
    const result = await this.database.query(
      `SELECT id, actor_email AS "actorEmail", action, resource_type AS "resourceType",
              resource_id AS "resourceId", correlation_id AS "correlationId",
              source_ip::text AS "sourceIp", before_state AS "beforeState",
              after_state AS "afterState", occurred_at AS "occurredAt"
       FROM audit.audit_events
       WHERE workspace_id = $1 AND ($3::text IS NULL OR action = $3)
       ORDER BY occurred_at DESC LIMIT $2`,
      [workspaceId, limit, action ?? null],
    );
    return result.rows;
  }
}
