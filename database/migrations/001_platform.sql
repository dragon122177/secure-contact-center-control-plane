CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS routing;
CREATE SCHEMA IF NOT EXISTS calls;
CREATE SCHEMA IF NOT EXISTS automation;
CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS audit;

DO $$ BEGIN
  CREATE TYPE identity.user_role AS ENUM ('ADMIN', 'SUPERVISOR', 'AGENT', 'AUDITOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE routing.agent_presence AS ENUM (
    'OFFLINE', 'AVAILABLE', 'RESERVED', 'ON_CALL', 'WRAP_UP', 'BREAK'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE calls.call_direction AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE calls.call_status AS ENUM (
    'RECEIVED', 'QUEUED', 'ROUTING', 'RINGING', 'ACTIVE', 'WRAP_UP',
    'COMPLETED', 'ABANDONED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS identity.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role identity.user_role NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS routing.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE TABLE IF NOT EXISTS routing.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE TABLE IF NOT EXISTS routing.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES routing.teams(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  extension TEXT,
  presence routing.agent_presence NOT NULL DEFAULT 'OFFLINE',
  max_concurrent_calls SMALLINT NOT NULL DEFAULT 1 CHECK (max_concurrent_calls BETWEEN 1 AND 5),
  active_call_count SMALLINT NOT NULL DEFAULT 0 CHECK (active_call_count >= 0),
  last_assigned_at TIMESTAMPTZ,
  last_presence_change_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_id),
  UNIQUE (workspace_id, extension)
);

CREATE TABLE IF NOT EXISTS routing.agent_skills (
  agent_id UUID NOT NULL REFERENCES routing.agents(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES routing.skills(id) ON DELETE CASCADE,
  proficiency SMALLINT NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  PRIMARY KEY (agent_id, skill_id)
);

CREATE TABLE IF NOT EXISTS routing.queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  service_level_seconds INTEGER NOT NULL DEFAULT 30 CHECK (service_level_seconds > 0),
  max_wait_seconds INTEGER NOT NULL DEFAULT 300 CHECK (max_wait_seconds > 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE TABLE IF NOT EXISTS routing.queue_skills (
  queue_id UUID NOT NULL REFERENCES routing.queues(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES routing.skills(id) ON DELETE CASCADE,
  required BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (queue_id, skill_id)
);

CREATE TABLE IF NOT EXISTS routing.queue_members (
  queue_id UUID NOT NULL REFERENCES routing.queues(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES routing.agents(id) ON DELETE CASCADE,
  priority SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (queue_id, agent_id)
);

CREATE TABLE IF NOT EXISTS routing.routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES identity.workspaces(id) ON DELETE CASCADE,
  queue_id UUID NOT NULL REFERENCES routing.queues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('SKILL_IDLE', 'ROUND_ROBIN', 'LEAST_ACTIVE')),
  priority SMALLINT NOT NULL DEFAULT 100,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
