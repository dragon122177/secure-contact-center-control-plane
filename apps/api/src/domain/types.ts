export const USER_ROLES = ['ADMIN', 'SUPERVISOR', 'AGENT', 'AUDITOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AGENT_PRESENCES = [
  'OFFLINE',
  'AVAILABLE',
  'RESERVED',
  'ON_CALL',
  'WRAP_UP',
  'BREAK',
] as const;
export type AgentPresence = (typeof AGENT_PRESENCES)[number];

export const CALL_STATUSES = [
  'RECEIVED',
  'QUEUED',
  'ROUTING',
  'RINGING',
  'ACTIVE',
  'WRAP_UP',
  'COMPLETED',
  'ABANDONED',
  'FAILED',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const PROVIDER_EVENT_TYPES = [
  'CALL_RECEIVED',
  'CALL_QUEUED',
  'AGENT_RINGING',
  'AGENT_ANSWERED',
  'CALL_ENDED',
  'CALL_ABANDONED',
  'CALL_FAILED',
] as const;
export type ProviderEventType = (typeof PROVIDER_EVENT_TYPES)[number];

export type AuthenticatedUser = {
  id: string;
  workspaceId: string;
  email: string;
  role: UserRole;
};

export type RoutingCandidate = {
  id: string;
  displayName: string;
  presence: AgentPresence;
  skills: string[];
  lastAssignedAt: Date | null;
  activeCallCount: number;
  maxConcurrentCalls: number;
};

export type RoutingRequest = {
  requiredSkills: string[];
  preferredSkills?: string[];
};

export type RoutingDecision = {
  agentId: string;
  score: number;
  reason: string;
};

export type ProviderWebhook = {
  eventId: string;
  eventType: ProviderEventType;
  occurredAt: string;
  call: {
    providerCallId: string;
    direction: 'INBOUND' | 'OUTBOUND';
    from: string;
    to: string;
    queueKey?: string;
    agentExternalId?: string;
    endedReason?: string;
  };
  metadata?: Record<string, string>;
};

export type DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  workspaceId: string;
  occurredAt: string;
  correlationId: string;
  payload: TPayload;
};

export type AutomationCondition = {
  field: 'endedReason' | 'queueKey' | 'direction' | 'status';
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
};

export type AutomationAction = {
  type: 'ADD_TAG' | 'SET_DISPOSITION' | 'NOTIFY_SUPERVISOR';
  value: string;
};
