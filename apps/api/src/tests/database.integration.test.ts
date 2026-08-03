import { afterAll, describe, expect, it } from 'vitest';
import { Database } from '../database/client.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const database = testDatabaseUrl ? new Database(testDatabaseUrl) : null;

describe.skipIf(!testDatabaseUrl)('seeded database integration', () => {
  afterAll(async () => {
    await database?.close();
  });

  it('contains exactly 12 enabled synthetic agents', async () => {
    const result = await database?.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM routing.agents WHERE enabled',
    );
    expect(result?.rows[0]?.count).toBe(12);
  });

  it('enforces provider-event idempotency per workspace', async () => {
    const constraints = await database?.query<{ constraint_name: string }>(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = 'events' AND table_name = 'webhook_inbox' AND constraint_type = 'UNIQUE'`,
    );
    expect(constraints?.rows.length).toBeGreaterThan(0);
  });
});
