# ADR 0002: Use a transactional inbox and outbox

- Status: accepted
- Date: 2026-08-03

## Context

Providers retry webhooks and networks fail between a database commit and an event-bus publish.
Directly applying every webhook or publishing inside the request without durable state creates
duplicate side effects or lost events.

## Decision

Use a unique webhook inbox key to deduplicate ingress. Commit call state, history, audit, and an
outbox row in one PostgreSQL transaction. A worker claims outbox rows with `SKIP LOCKED`, publishes
to Kafka, and records success with bounded exponential retries.

## Consequences

No accepted state change lacks a durable event. Delivery to Kafka is at least once, so consumers must
deduplicate by outbox event ID. The database carries a small operational queue that needs monitoring
and retention.
