# Provider integration

RelayOps models integration with a provider-hosted VoIP and network-access platform. The example
provider, people, numbers, and ranges are fictional.

## Responsibility boundary

RelayOps configures and records:

- external agent IDs and extensions;
- queues, membership, skills, and routing decisions;
- signed provider lifecycle events;
- VPN/proxy policy metadata and access decisions;
- automation, operational visibility, and audit evidence.

The provider remains responsible for:

- SIP/RTP transport and call audio;
- carrier connectivity and telephone-number ownership;
- VPN/proxy tunnel establishment and cryptography;
- provider user accounts outside RelayOps;
- billing, payment, taxation, and invoicing.

## Webhook authentication

Every request includes:

- `x-relayops-timestamp`: Unix time in seconds;
- `x-relayops-signature`: lowercase HMAC-SHA256 hex.

The signed content is:

```text
{timestamp}.{canonicalJson(requestBody)}
```

Canonical JSON sorts object keys recursively while preserving array order. The API compares
signatures in constant time and rejects timestamps outside the configured five-minute window. A
production adapter may instead sign exact raw request bytes when that is the provider contract.

## Supported lifecycle events

| Provider event   | RelayOps target                        | Side effects                                      |
| ---------------- | -------------------------------------- | ------------------------------------------------- |
| `CALL_RECEIVED`  | `RECEIVED`, then `ROUTING` or `QUEUED` | Create call, select queue, reserve eligible agent |
| `CALL_QUEUED`    | `QUEUED`                               | Record provider queue confirmation                |
| `AGENT_RINGING`  | `RINGING`                              | Resolve provider agent, mark `RESERVED`           |
| `AGENT_ANSWERED` | `ACTIVE`                               | Record answer time, mark `ON_CALL`                |
| `CALL_ENDED`     | `COMPLETED`                            | Release capacity, schedule matching automation    |
| `CALL_ABANDONED` | `ABANDONED`                            | Release reservation, schedule callback automation |
| `CALL_FAILED`    | `FAILED`                               | Release reservation, preserve reason              |

Providers sometimes omit an intermediate ringing event, so `ROUTING → ACTIVE` and
`QUEUED → ACTIVE` are accepted. Terminal states cannot return to an active state.

## Idempotency and ordering

The provider must send a globally unique `eventId` within a workspace. RelayOps inserts that ID into
the webhook inbox before changing the call. Repeated IDs receive a successful duplicate response
without repeating side effects.

A different event ID for an impossible transition receives `409`. The provider should retry
temporary `5xx` responses with jitter, but it should investigate a persistent `409` as an ordering or
mapping error.

## Try the adapter

With the stack running:

```bash
npm run demo:webhook -- samples/call-received.json
```

For later lifecycle events, keep the same provider call ID:

```bash
PROVIDER_CALL_ID=provider-demo-call-1001 \
  npm run demo:webhook -- samples/call-ended.json
```

The helper refreshes event IDs and timestamps, computes the signature locally, and sends no real
credentials or caller data.

## Adding a real provider adapter

1. Map provider event names and payloads into the canonical schema in `domain/types.ts`.
2. Implement the provider's signature algorithm and raw-body rules.
3. Store a different secret per workspace in a secret manager, not in PostgreSQL plaintext.
4. Add contract fixtures for every lifecycle and error event.
5. Run a replay test to prove idempotency before enabling production traffic.
6. Keep audio and billing outside the adapter unless the product scope explicitly changes.
