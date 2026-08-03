import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const filename = process.argv[2] ?? 'samples/call-received.json';
const endpoint =
  process.env.RELAYOPS_WEBHOOK_URL ?? 'http://localhost:8080/api/v1/provider/webhooks/acme-support';
const secret = process.env.PROVIDER_WEBHOOK_SECRET ?? 'local-provider-webhook-secret';
const payload = JSON.parse(await readFile(filename, 'utf8'));
payload.occurredAt = new Date().toISOString();
payload.eventId = `${payload.eventId}-${Date.now()}`;
if (process.env.PROVIDER_CALL_ID) payload.call.providerCallId = process.env.PROVIDER_CALL_ID;

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
    .join(',')}}`;
}

const timestamp = String(Math.floor(Date.now() / 1000));
const signature = createHmac('sha256', secret)
  .update(`${timestamp}.${canonicalize(payload)}`)
  .digest('hex');

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-relayops-timestamp': timestamp,
    'x-relayops-signature': signature,
  },
  body: JSON.stringify(payload),
});

console.log(response.status, await response.text());
process.exitCode = response.ok ? 0 : 1;
