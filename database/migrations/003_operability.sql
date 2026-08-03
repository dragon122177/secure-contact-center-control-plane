CREATE INDEX IF NOT EXISTS idx_agents_workspace_presence
  ON routing.agents (workspace_id, presence) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_queue_members_agent ON routing.queue_members (agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_workspace_status_started
  ON calls.call_sessions (workspace_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_events_call_occurred
  ON calls.call_events (call_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_pending
  ON automation.runs (scheduled_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_network_sessions_agent_connected
  ON security.agent_network_sessions (agent_id, connected_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON events.outbox_events (available_at, created_at) WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX IF NOT EXISTS idx_audit_workspace_occurred
  ON audit.audit_events (workspace_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target REGCLASS;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'identity.workspaces'::regclass,
    'identity.users'::regclass,
    'routing.teams'::regclass,
    'routing.agents'::regclass,
    'routing.queues'::regclass,
    'routing.routing_rules'::regclass,
    'calls.call_sessions'::regclass,
    'automation.rules'::regclass,
    'security.network_policies'::regclass
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %s', target);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      target
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION audit.prevent_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_append_only ON audit.audit_events;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit.audit_events
  FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

CREATE OR REPLACE VIEW calls.live_queue_metrics AS
SELECT
  q.workspace_id,
  q.id AS queue_id,
  q.key AS queue_key,
  q.display_name,
  count(c.id) FILTER (WHERE c.status IN ('RECEIVED', 'QUEUED', 'ROUTING', 'RINGING')) AS waiting_calls,
  count(c.id) FILTER (WHERE c.status = 'ACTIVE') AS active_calls,
  coalesce(
    avg(extract(epoch FROM (now() - c.started_at)))
      FILTER (WHERE c.status IN ('RECEIVED', 'QUEUED', 'ROUTING', 'RINGING')),
    0
  )::INTEGER AS average_wait_seconds
FROM routing.queues q
LEFT JOIN calls.call_sessions c ON c.queue_id = q.id
GROUP BY q.workspace_id, q.id, q.key, q.display_name;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
