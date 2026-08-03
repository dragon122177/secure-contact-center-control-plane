import { describe, expect, it } from 'vitest';
import {
  InvalidCallTransitionError,
  applyProviderEvent,
  isTerminalCallStatus,
  transitionCall,
} from '../domain/call-state-machine.js';

describe('call state machine', () => {
  it('accepts a normal inbound lifecycle', () => {
    expect(applyProviderEvent(null, 'CALL_RECEIVED')).toBe('RECEIVED');
    expect(transitionCall('RECEIVED', 'ROUTING')).toBe('ROUTING');
    expect(transitionCall('ROUTING', 'RINGING')).toBe('RINGING');
    expect(transitionCall('RINGING', 'ACTIVE')).toBe('ACTIVE');
    expect(transitionCall('ACTIVE', 'COMPLETED')).toBe('COMPLETED');
  });

  it('allows providers to omit an intermediate ringing event', () => {
    expect(transitionCall('ROUTING', 'ACTIVE')).toBe('ACTIVE');
    expect(transitionCall('QUEUED', 'ACTIVE')).toBe('ACTIVE');
  });

  it('allows a caller to abandon while a routing decision is pending', () => {
    expect(transitionCall('ROUTING', 'ABANDONED')).toBe('ABANDONED');
  });

  it('rejects an impossible transition from a terminal state', () => {
    expect(() => transitionCall('COMPLETED', 'ACTIVE')).toThrow(InvalidCallTransitionError);
  });

  it('treats repeated state updates as idempotent', () => {
    expect(transitionCall('ACTIVE', 'ACTIVE')).toBe('ACTIVE');
  });

  it('identifies all terminal statuses', () => {
    expect(isTerminalCallStatus('COMPLETED')).toBe(true);
    expect(isTerminalCallStatus('ABANDONED')).toBe(true);
    expect(isTerminalCallStatus('FAILED')).toBe(true);
    expect(isTerminalCallStatus('ACTIVE')).toBe(false);
  });
});
