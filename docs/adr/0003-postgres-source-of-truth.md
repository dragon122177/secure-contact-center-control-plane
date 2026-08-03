# ADR 0003: PostgreSQL is authoritative; Redis is disposable

- Status: accepted
- Date: 2026-08-03

## Context

Agent presence and queue dashboards need fast updates across API instances, but routing and call
state cannot be lost when a cache restarts.

## Decision

PostgreSQL remains authoritative for agents, calls, queues, events, automation, policy decisions, and
audit evidence. Redis Pub/Sub distributes dashboard invalidations only. UI polling provides a
fallback.

## Consequences

A Redis outage degrades freshness but does not lose business state. PostgreSQL transactions and
indexes require careful capacity planning as traffic grows. A future high-volume presence service
could use Redis streams or a dedicated store while preserving durable transition history.
