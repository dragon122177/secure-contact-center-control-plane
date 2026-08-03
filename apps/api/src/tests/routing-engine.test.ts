import { describe, expect, it } from 'vitest';
import type { RoutingCandidate } from '../domain/types.js';
import { routeCall } from '../domain/routing-engine.js';

const now = new Date('2026-08-03T12:00:00.000Z');

function candidate(overrides: Partial<RoutingCandidate>): RoutingCandidate {
  return {
    id: 'agent-default',
    displayName: 'Default Agent',
    presence: 'AVAILABLE',
    skills: ['english'],
    lastAssignedAt: new Date('2026-08-03T11:00:00.000Z'),
    activeCallCount: 0,
    maxConcurrentCalls: 1,
    ...overrides,
  };
}

describe('skill-and-idle routing', () => {
  it('filters agents without required skills or availability', () => {
    const decision = routeCall(
      { requiredSkills: ['security'] },
      [
        candidate({ id: 'available-security', skills: ['english', 'security'] }),
        candidate({ id: 'wrong-skill', skills: ['english'] }),
        candidate({ id: 'busy-security', skills: ['security'], presence: 'ON_CALL' }),
      ],
      now,
    );

    expect(decision?.agentId).toBe('available-security');
  });

  it('prefers a preferred skill before idle time', () => {
    const decision = routeCall(
      { requiredSkills: ['english'], preferredSkills: ['japanese'] },
      [
        candidate({ id: 'idle', lastAssignedAt: new Date('2026-08-03T02:00:00.000Z') }),
        candidate({ id: 'japanese', skills: ['english', 'japanese'] }),
      ],
      now,
    );

    expect(decision?.agentId).toBe('japanese');
    expect(decision?.reason).toContain('1 preferred skills matched');
  });

  it('uses least recently assigned when skills are equal', () => {
    const decision = routeCall(
      { requiredSkills: ['english'] },
      [
        candidate({ id: 'recent', lastAssignedAt: new Date('2026-08-03T11:50:00.000Z') }),
        candidate({ id: 'idle', lastAssignedAt: new Date('2026-08-03T08:00:00.000Z') }),
      ],
      now,
    );
    expect(decision?.agentId).toBe('idle');
  });

  it('returns null when there is no eligible agent', () => {
    expect(
      routeCall(
        { requiredSkills: ['english'] },
        [candidate({ presence: 'OFFLINE' }), candidate({ activeCallCount: 1 })],
        now,
      ),
    ).toBeNull();
  });
});
