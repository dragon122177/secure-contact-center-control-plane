import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignatureVerificationOptions = {
  secret: string;
  signature: string;
  timestamp: string;
  payload: unknown;
  toleranceSeconds: number;
  now?: Date;
};

export function canonicalizePayload(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalizePayload).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalizePayload(entryValue)}`)
    .join(',')}}`;
}

export function createProviderSignature(
  secret: string,
  timestamp: string,
  payload: unknown,
): string {
  const canonicalPayload = canonicalizePayload(payload);
  return createHmac('sha256', secret).update(`${timestamp}.${canonicalPayload}`).digest('hex');
}

export function verifyProviderSignature(options: SignatureVerificationOptions): boolean {
  const timestampSeconds = Number(options.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > options.toleranceSeconds) return false;

  const expected = createProviderSignature(options.secret, options.timestamp, options.payload);
  const actualBuffer = Buffer.from(options.signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
