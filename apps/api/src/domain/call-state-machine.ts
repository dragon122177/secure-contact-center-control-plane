import type { CallStatus, ProviderEventType } from './types.js';

const eventTargetStatus: Record<ProviderEventType, CallStatus> = {
  CALL_RECEIVED: 'RECEIVED',
  CALL_QUEUED: 'QUEUED',
  AGENT_RINGING: 'RINGING',
  AGENT_ANSWERED: 'ACTIVE',
  CALL_ENDED: 'COMPLETED',
  CALL_ABANDONED: 'ABANDONED',
  CALL_FAILED: 'FAILED',
};

const allowedTransitions: Record<CallStatus, ReadonlySet<CallStatus>> = {
  RECEIVED: new Set(['QUEUED', 'ROUTING', 'FAILED']),
  QUEUED: new Set(['ROUTING', 'RINGING', 'ACTIVE', 'ABANDONED', 'FAILED']),
  ROUTING: new Set(['RINGING', 'ACTIVE', 'QUEUED', 'ABANDONED', 'FAILED']),
  RINGING: new Set(['ACTIVE', 'QUEUED', 'ABANDONED', 'FAILED']),
  ACTIVE: new Set(['WRAP_UP', 'COMPLETED', 'FAILED']),
  WRAP_UP: new Set(['COMPLETED']),
  COMPLETED: new Set(),
  ABANDONED: new Set(),
  FAILED: new Set(),
};

export class InvalidCallTransitionError extends Error {
  constructor(current: CallStatus, next: CallStatus) {
    super(`Invalid call transition: ${current} -> ${next}`);
    this.name = 'InvalidCallTransitionError';
  }
}

export function statusForProviderEvent(eventType: ProviderEventType): CallStatus {
  return eventTargetStatus[eventType];
}

export function transitionCall(current: CallStatus, next: CallStatus): CallStatus {
  if (current === next) {
    return current;
  }

  if (!allowedTransitions[current].has(next)) {
    throw new InvalidCallTransitionError(current, next);
  }

  return next;
}

export function applyProviderEvent(
  current: CallStatus | null,
  eventType: ProviderEventType,
): CallStatus {
  const next = statusForProviderEvent(eventType);
  if (current === null) {
    if (eventType !== 'CALL_RECEIVED') {
      throw new InvalidCallTransitionError('RECEIVED', next);
    }
    return next;
  }

  return transitionCall(current, next);
}

export function isTerminalCallStatus(status: CallStatus): boolean {
  return allowedTransitions[status].size === 0;
}
