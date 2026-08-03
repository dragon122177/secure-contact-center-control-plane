# Testing strategy

The test suite concentrates on decisions that would create operational incidents if they regressed.

## Test layers

- **Pure domain tests:** call-state transitions, skill-aware routing, automation conditions, CIDR
  matching, and webhook signatures.
- **Component tests:** status presentation, accessible page headings, and empty states.
- **Database integration tests:** run when `TEST_DATABASE_URL` is present; CI applies migrations and
  synthetic seed first.
- **Production builds:** TypeScript, API bundling, Vite bundling, and both Dockerfiles run in CI.
- **Static checks:** Prettier, ESLint, CodeQL, and production dependency audit.

## Local commands

```bash
npm test
npm run test:coverage
npm run typecheck
npm run lint
npm run build
npm run check
```

## High-value scenarios

The current suite proves:

- terminal calls cannot become active again;
- a provider may skip an optional ringing event;
- required skills and availability are hard routing filters;
- preferred skills outrank idle time as designed;
- no eligible agent produces a safe queue fallback;
- automation comparisons are case-insensitive and conjunctive;
- exact, open, invalid, and multi-range IPv4 CIDRs behave safely;
- tampered and replayed webhook signatures fail;
- the seeded integration environment contains exactly twelve synthetic agents;
- webhook inbox uniqueness exists at the database boundary.

## Future expansion

Add Testcontainers or ephemeral Docker Compose integration tests for the full webhook transaction,
outbox crash windows, concurrent routing claims, worker retry exhaustion, WebSocket reconnects, and
tenant-isolation property tests. Provider contract fixtures should be versioned before connecting a
real vendor.
