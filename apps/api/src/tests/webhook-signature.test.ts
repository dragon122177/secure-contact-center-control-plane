import { describe, expect, it } from 'vitest';
import { createProviderSignature, verifyProviderSignature } from '../services/webhook-signature.js';

const secret = 'test-provider-secret-value';
const payload = { eventId: 'evt-42', eventType: 'CALL_RECEIVED' };
const now = new Date('2026-08-03T12:00:00.000Z');
const timestamp = String(Math.floor(now.getTime() / 1000));

describe('provider webhook signature', () => {
  it('accepts a correctly signed, recent payload', () => {
    const signature = createProviderSignature(secret, timestamp, payload);
    expect(
      verifyProviderSignature({
        secret,
        signature,
        timestamp,
        payload,
        toleranceSeconds: 300,
        now,
      }),
    ).toBe(true);
  });

  it('is stable when object keys arrive in a different order', () => {
    const signature = createProviderSignature(secret, timestamp, payload);
    const reordered = { eventType: 'CALL_RECEIVED', eventId: 'evt-42' };
    expect(
      verifyProviderSignature({
        secret,
        signature,
        timestamp,
        payload: reordered,
        toleranceSeconds: 300,
        now,
      }),
    ).toBe(true);
  });

  it('rejects tampered payloads', () => {
    const signature = createProviderSignature(secret, timestamp, payload);
    expect(
      verifyProviderSignature({
        secret,
        signature,
        timestamp,
        payload: { ...payload, eventType: 'CALL_ENDED' },
        toleranceSeconds: 300,
        now,
      }),
    ).toBe(false);
  });

  it('rejects stale timestamps and malformed signatures', () => {
    const oldTimestamp = String(Number(timestamp) - 301);
    const signature = createProviderSignature(secret, oldTimestamp, payload);
    expect(
      verifyProviderSignature({
        secret,
        signature,
        timestamp: oldTimestamp,
        payload,
        toleranceSeconds: 300,
        now,
      }),
    ).toBe(false);
    expect(
      verifyProviderSignature({
        secret,
        signature: 'bad',
        timestamp,
        payload,
        toleranceSeconds: 300,
        now,
      }),
    ).toBe(false);
  });
});
