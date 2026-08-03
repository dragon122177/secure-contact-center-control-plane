# Operations runbook

## Service objectives

Suggested initial objectives for a small deployment:

| Indicator                         | Objective                                   |
| --------------------------------- | ------------------------------------------- |
| Authenticated API availability    | 99.9% over 30 days                          |
| Provider webhook accepted latency | p95 below 500 ms                            |
| Provider event processing success | 99.95%, excluding invalid signatures/schema |
| Outbox publication delay          | p95 below 30 seconds                        |
| Automation completion delay       | p95 below 60 seconds                        |

These are proposed targets, not measurements claimed by this repository.

## Local startup

```bash
cp .env.example .env
docker compose up --build
```

Expected endpoints:

- console: `http://localhost:3000`;
- API readiness: `http://localhost:8080/health/ready`;
- Prometheus: `http://localhost:9090`;
- Grafana: `http://localhost:3001` (`admin` / `relayops` locally only).

The one-shot `migrate` service applies checksum-protected migrations and loads synthetic demo data.

## Triage order

1. Confirm `/health/live` and `/health/ready`.
2. Locate the request using `x-correlation-id`.
3. Check API/worker logs without copying caller numbers or credentials.
4. Inspect PostgreSQL inbox, outbox, call events, and automation runs.
5. Check Redpanda health and consumer availability.
6. Check Redis only for realtime-dashboard symptoms; it is not authoritative.

## Incident: provider events rejected

Symptoms: provider sees `401`, `409`, or elevated retry volume.

- `401`: verify clock synchronization, active secret version, canonical JSON, and signature header.
- `409`: inspect the current call status and ordered `calls.call_events`; do not manually force a
  terminal call active.
- `422`: verify queue keys and agent external IDs are configured.
- `5xx`: check PostgreSQL readiness and transaction errors, then allow provider retries.

Never disable signature verification as a recovery step.

## Incident: outbox backlog

Detection query:

```sql
SELECT status, count(*), min(created_at) AS oldest
FROM events.outbox_events
WHERE status <> 'PUBLISHED'
GROUP BY status;
```

Actions:

1. Confirm Kafka brokers and DNS/TLS/SASL settings.
2. Inspect `last_error` and `attempt_count` without resetting successful rows.
3. Scale workers if Kafka is healthy and claim throughput is the bottleneck.
4. For rows at eight attempts, fix the cause, then deliberately set only reviewed event IDs back to
   `PENDING` with a new `available_at`.

Duplicate delivery is possible; downstream consumers deduplicate by event ID.

## Incident: automation failures

```sql
SELECT r.id, rules.name, r.attempt_count, r.last_error, r.finished_at
FROM automation.runs r
JOIN automation.rules rules ON rules.id = r.rule_id
WHERE r.status = 'FAILED'
ORDER BY r.finished_at DESC;
```

Correct the action configuration or dependency. Do not blindly replay non-idempotent future action
types. Current tag and disposition actions are idempotent by implementation.

## Incident: stale dashboard

If authoritative REST reads are current but live updates are stale:

1. Check browser WebSocket state and ingress upgrade headers.
2. Check Redis connectivity and `relayops:live-events` Pub/Sub traffic.
3. Keep polling enabled; it provides eventual refresh during Redis recovery.

Do not modify PostgreSQL to repair a presentation-only issue.

## Database migration failure

Migrations acquire a PostgreSQL advisory lock and validate checksums. If startup reports that an
applied migration changed, restore the original file and create a new forward migration. Never edit a
migration that has reached any shared environment.

For a failed new migration, preserve logs, determine whether PostgreSQL rolled the transaction back,
fix the migration in a new commit, and redeploy. Migrations here are transactional.

## Backup and recovery

A real deployment should use managed PostgreSQL point-in-time recovery plus periodic restore tests.
Redis can be rebuilt. Kafka retention and replication depend on downstream recovery needs. The Git
repository remains the source for schemas and configuration definitions, not runtime secrets.

Recovery priority:

1. PostgreSQL (workspace, calls, configuration, inbox/outbox, evidence);
2. provider webhook ingestion;
3. worker publication and automation;
4. Redis realtime fan-out;
5. dashboards and historical metrics.

## Rollback

Application images should be immutable and versioned. Roll back API and worker together when an
event contract changes. Database changes are forward-only; use a compatible corrective migration
instead of destructive down-migrations. Preserve outbox and inbox records through every rollback.
