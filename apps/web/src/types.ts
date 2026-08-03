export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT' | 'AUDITOR';
export type AgentPresence = 'OFFLINE' | 'AVAILABLE' | 'RESERVED' | 'ON_CALL' | 'WRAP_UP' | 'BREAK';
export type CallStatus =
  | 'RECEIVED'
  | 'QUEUED'
  | 'ROUTING'
  | 'RINGING'
  | 'ACTIVE'
  | 'WRAP_UP'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'FAILED';

export type AuthUser = {
  id: string;
  workspaceId: string;
  email: string;
  role: UserRole;
  displayName: string;
};

export type LoginResponse = {
  accessToken: string;
  expiresIn: string;
  user: AuthUser;
};

export type Agent = {
  id: string;
  externalId: string;
  displayName: string;
  extension: string;
  presence: AgentPresence;
  activeCallCount: number;
  maxConcurrentCalls: number;
  lastAssignedAt: string | null;
  lastPresenceChangeAt: string;
  teamName: string;
  skills: string[];
};

export type Queue = {
  id: string;
  key: string;
  displayName: string;
  description: string;
  serviceLevelSeconds: number;
  maxWaitSeconds: number;
  enabled: boolean;
  memberCount: number;
  availableAgents: number;
  requiredSkills: string[];
  waitingCalls: number;
  activeCalls: number;
  averageWaitSeconds: number;
};

export type Call = {
  id: string;
  providerCallId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: CallStatus;
  callerNumber: string;
  destinationNumber: string;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endedReason: string | null;
  disposition: string | null;
  tags: string[];
  queueName: string | null;
  agentName: string | null;
};

export type Dashboard = {
  agents: { total: number; available: number; on_call: number; offline: number };
  calls: { active: number; waiting: number; completed_today: number; abandoned_today: number };
  queues: Array<{
    queueId: string;
    queueKey: string;
    displayName: string;
    waitingCalls: number;
    activeCalls: number;
    averageWaitSeconds: number;
  }>;
  automations: { pending: number; failed: number };
  recentActivity: AuditEvent[];
  generatedAt: string;
};

export type AutomationRule = {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  conditions: Array<{ field: string; operator: string; value: string }>;
  actions: Array<{ type: string; value: string }>;
  enabled: boolean;
  createdAt: string;
};

export type AutomationRun = {
  id: string;
  status: string;
  attemptCount: number;
  result: unknown;
  lastError: string | null;
  scheduledAt: string;
  finishedAt: string | null;
  ruleName: string;
  providerCallId: string | null;
};

export type NetworkPolicy = {
  id: string;
  name: string;
  providerName: string;
  accessType: 'VPN' | 'PROXY' | 'DIRECT';
  allowedCidrs: string[];
  requireManagedDevice: boolean;
  enabled: boolean;
  notes: string;
};

export type NetworkSession = {
  id: string;
  sourceIp: string;
  deviceId: string | null;
  decision: 'ALLOW' | 'DENY';
  reason: string;
  connectedAt: string;
  agentName: string;
  policyName: string | null;
};

export type AuditEvent = {
  id: string;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  correlationId?: string;
  sourceIp?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  occurredAt: string;
};
