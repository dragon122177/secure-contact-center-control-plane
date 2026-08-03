CREATE TABLE IF NOT EXISTS calls.call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  provider_call_id TEXT NOT NULL,
  queue_id UUID REFERENCES routing.queues(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES routing.agents(id) ON DELETE SET NULL,
  direction calls.call_direction NOT NULL,
  status calls.call_status NOT NULL DEFAULT 'RECEIVED',
  caller_number TEXT NOT NULL,
  destination_number TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,
  disposition TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider_call_id)
);

CREATE TABLE IF NOT EXISTS calls.call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls.call_sessions(id) ON DELETE CASCADE,
  provider_event_id TEXT,
  event_type TEXT NOT NULL,
  previous_status calls.call_status,
  current_status calls.call_status NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider_event_id)
);

CREATE TABLE IF NOT EXISTS automation.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_event TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES identity.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES automation.rules(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls.call_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security.network_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('VPN', 'PROXY', 'DIRECT')),
  allowed_cidrs CIDR[] NOT NULL DEFAULT '{}',
  require_managed_device BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security.agent_network_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES routing.agents(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES security.network_policies(id) ON DELETE SET NULL,
  source_ip INET NOT NULL,
  device_id TEXT,
  provider_session_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'DENY')),
  reason TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.webhook_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'REJECTED')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (workspace_id, provider_event_id)
);

CREATE TABLE IF NOT EXISTS events.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  correlation_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES identity.users(id) ON DELETE RESTRICT,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  correlation_id UUID NOT NULL,
  source_ip INET,
  user_agent TEXT,
  before_state JSONB,
  after_state JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
