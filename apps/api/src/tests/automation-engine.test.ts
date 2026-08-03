import { describe, expect, it } from 'vitest';
import { automationMatches } from '../domain/automation-engine.js';
import type { ProviderWebhook } from '../domain/types.js';

const webhook: ProviderWebhook = {
  eventId: 'evt-1',
  eventType: 'CALL_ENDED',
  occurredAt: '2026-08-03T12:00:00.000Z',
  call: {
    providerCallId: 'call-1',
    direction: 'INBOUND',
    from: '+81-50-0000-0001',
    to: '+81-50-5555-0100',
    queueKey: 'security-escalations',
    endedReason: 'NORMAL_CLEARING',
  },
};

describe('automation conditions', () => {
  it('matches multiple case-insensitive conditions', () => {
    expect(
      automationMatches(
        [
          { field: 'endedReason', operator: 'equals', value: 'normal_clearing' },
          { field: 'queueKey', operator: 'contains', value: 'security' },
          { field: 'direction', operator: 'not_equals', value: 'outbound' },
        ],
        webhook,
        'COMPLETED',
      ),
    ).toBe(true);
  });

  it('fails when one condition does not match', () => {
    expect(
      automationMatches(
        [{ field: 'status', operator: 'equals', value: 'ABANDONED' }],
        webhook,
        'COMPLETED',
      ),
    ).toBe(false);
  });
});
