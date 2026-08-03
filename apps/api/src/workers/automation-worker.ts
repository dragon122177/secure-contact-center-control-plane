import type { PoolClient } from 'pg';
import type { Database } from '../database/client.js';
import type { AutomationAction } from '../domain/types.js';

type AutomationRun = {
  id: string;
  workspace_id: string;
  rule_id: string;
  call_id: string | null;
  attempt_count: number;
  actions: AutomationAction[];
};

export class AutomationWorker {
  constructor(private readonly database: Database) {}

  async runOnce(batchSize = 10): Promise<number> {
    const runs = await this.database.transaction(async (client) => {
      const result = await client.query<AutomationRun>(
        `SELECT r.id, r.workspace_id, r.rule_id, r.call_id, r.attempt_count, rules.actions
         FROM automation.runs r
         JOIN automation.rules rules ON rules.id = r.rule_id
         WHERE r.status = 'PENDING' AND r.scheduled_at <= now() AND r.attempt_count < 5
         ORDER BY r.scheduled_at
         FOR UPDATE OF r SKIP LOCKED
         LIMIT $1`,
        [batchSize],
      );
      if (result.rows.length > 0) {
        await client.query(
          `UPDATE automation.runs
           SET status = 'RUNNING', started_at = now(), attempt_count = attempt_count + 1
           WHERE id = ANY($1::uuid[])`,
          [result.rows.map((row) => row.id)],
        );
      }
      return result.rows;
    });

    for (const run of runs) {
      try {
        const executed = await this.database.transaction(async (client) => {
          const results = [];
          for (const action of run.actions) {
            results.push(await this.executeAction(client, run, action));
          }
          await client.query(
            `UPDATE automation.runs
             SET status = 'SUCCEEDED', result = $2::jsonb, finished_at = now(), last_error = NULL
             WHERE id = $1`,
            [run.id, JSON.stringify({ executed: results })],
          );
          return results;
        });
        void executed;
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 1000) : 'Unknown automation error';
        const nextStatus = run.attempt_count + 1 >= 5 ? 'FAILED' : 'PENDING';
        await this.database.query(
          `UPDATE automation.runs
           SET status = $2, last_error = $3,
               scheduled_at = now() + (least(power(2, attempt_count), 300) * interval '1 second'),
               finished_at = CASE WHEN $2 = 'FAILED' THEN now() ELSE NULL END
           WHERE id = $1`,
          [run.id, nextStatus, message],
        );
      }
    }
    return runs.length;
  }

  private async executeAction(client: PoolClient, run: AutomationRun, action: AutomationAction) {
    if (!run.call_id) return { action: action.type, skipped: 'No call linked to run' };

    switch (action.type) {
      case 'ADD_TAG':
        await client.query(
          `UPDATE calls.call_sessions
           SET tags = array_append(tags, $2), version = version + 1
           WHERE id = $1 AND NOT ($2 = ANY(tags))`,
          [run.call_id, action.value],
        );
        return { action: action.type, value: action.value };
      case 'SET_DISPOSITION':
        await client.query(
          `UPDATE calls.call_sessions SET disposition = $2, version = version + 1 WHERE id = $1`,
          [run.call_id, action.value],
        );
        return { action: action.type, value: action.value };
      case 'NOTIFY_SUPERVISOR':
        await client.query(
          `INSERT INTO events.outbox_events (
             workspace_id, aggregate_type, aggregate_id, event_type, correlation_id, payload
           ) VALUES ($1, 'call', $2, 'supervisor.notification.requested', gen_random_uuid(), $3::jsonb)`,
          [
            run.workspace_id,
            run.call_id,
            JSON.stringify({ message: action.value, automationRunId: run.id }),
          ],
        );
        return { action: action.type, queued: true };
    }
  }
}
