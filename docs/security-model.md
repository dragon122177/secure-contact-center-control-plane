# Security model

RelayOps is a portfolio-grade reference implementation, not a certified telephone or payment
system. Its security choices demonstrate control-plane fundamentals while documenting the remaining
production work.

## Assets and trust boundaries

Protected assets are routing configuration, operator identities, call metadata, provider mappings,
network-access decisions, automation rules, secrets, and audit evidence. Call audio and billing data
are intentionally absent.

Untrusted boundaries include the browser, provider webhook endpoint, public ingress, and downstream
event consumers. PostgreSQL, Redis, and Kafka must be private network services in production.

## Implemented controls

- Passwords hashed with bcrypt (cost 12).
- HMAC-SHA256 provider authentication with constant-time comparison and replay tolerance.
- Short, validated request bodies with Zod.
- JWT issuer, audience, algorithm, and expiry checks.
- A 60-second, purpose-bound ticket for each WebSocket handshake instead of exposing the primary JWT.
- Role-based endpoint authorization.
- Parameterized SQL throughout the API and workers.
- Global and login/webhook-specific rate limits.
- Helmet security headers and explicit CORS origins.
- Correlation IDs returned to callers and stored in evidence/events.
- Sensitive log-field redaction for authorization, signatures, passwords, and phone numbers.
- Append-only audit table protected by a PostgreSQL trigger.
- Idempotent webhook inbox and transactional outbox.
- Non-root, read-only containers and Kubernetes capability drops.
- Default-deny Kubernetes network-policy example.
- No real secrets, caller data, provider configuration, or audio in the repository.

## Role matrix

| Capability                     |                   Admin                    | Supervisor | Agent | Auditor |
| ------------------------------ | :----------------------------------------: | :--------: | :---: | :-----: |
| View operational dashboard     |                     ✓                      |     ✓      |   ✓   |    ✓    |
| View agents, queues, and calls |                     ✓                      |     ✓      |   ✓   |    ✓    |
| Change manual presence         |                     ✓                      |     ✓      |   —   |    —    |
| Create automation rules        |                     ✓                      |     ✓      |   —   |    —    |
| Evaluate network policy        |                     ✓                      |     ✓      |   —   |    —    |
| Read audit evidence            |                     ✓                      |     ✓      |   —   |    ✓    |
| Ingest provider webhook        | HMAC integration identity, not a user role |

## Data minimization

The UI masks caller numbers. Logs redact known number fields. The database retains example call
metadata to demonstrate state transitions, but all seeded values use synthetic records. A real
deployment should additionally configure retention, encryption keys, regional residency, access
reviews, and deletion workflows according to its legal requirements.

## Production hardening backlog

Before real use:

1. Replace local passwords with OIDC/SAML and MFA; keep local login only for break-glass access.
2. Use asymmetric access tokens or a managed identity provider with key rotation.
3. Store one webhook secret per provider/workspace in a cloud secret manager and support rotation.
4. Enable TLS/mTLS for PostgreSQL, Redis, and Kafka; use Kafka SASL authorization.
5. Apply row-level security or a separate database boundary for stronger tenant isolation.
6. Add a web application firewall, distributed rate limits, and provider IP allowlists.
7. Export audit evidence to immutable external storage with retention controls.
8. Add SAST, dependency policies, container scanning, SBOM signing, and provenance attestations.
9. Perform threat modeling and an independent penetration test.

## Reporting

Follow [SECURITY.md](../SECURITY.md). Never open a public issue containing credentials, provider
payloads, real caller identifiers, or exploitable reproduction data.
