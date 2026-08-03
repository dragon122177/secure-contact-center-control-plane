import type { Database } from '../database/client.js';
import type { EventBus, PublishableEvent } from '../services/event-bus.js';

type OutboxRow = {
  id: string;
  workspace_id: string;
  aggregate_id: string;
  event_type: string;
  correlation_id: string;
  payload: unknown;
  attempt_count: number;
  created_at: string;
};

export class OutboxWorker {
  constructor(
    private readonly database: Database,
    private readonly eventBus: EventBus,
  ) {}

  async runOnce(batchSize = 25): Promise<number> {
    const events = await this.database.transaction(async (client) => {
      const claimed = await client.query<OutboxRow>(
        `SELECT id, workspace_id, aggregate_id::text, event_type, correlation_id::text,
                payload, attempt_count, created_at
         FROM events.outbox_events
         WHERE status IN ('PENDING','FAILED')
           AND available_at <= now()
           AND attempt_count < 8
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1`,
        [batchSize],
      );
      if (claimed.rows.length > 0) {
        await client.query(
          `UPDATE events.outbox_events
           SET status = 'PUBLISHING', attempt_count = attempt_count + 1
           WHERE id = ANY($1::uuid[])`,
          [claimed.rows.map((row) => row.id)],
        );
      }
      return claimed.rows;
    });

    for (const event of events) {
      try {
        const publishable: PublishableEvent = {
          id: event.id,
          eventType: event.event_type,
          aggregateId: event.aggregate_id,
          workspaceId: event.workspace_id,
          correlationId: event.correlation_id,
          payload: event.payload,
          createdAt: event.created_at,
        };
        await this.eventBus.publish(publishable);
        await this.database.query(
          `UPDATE events.outbox_events
           SET status = 'PUBLISHED', published_at = now(), last_error = NULL
           WHERE id = $1`,
          [event.id],
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 1000) : 'Unknown publish error';
        const delaySeconds = Math.min(2 ** (event.attempt_count + 1), 300);
        await this.database.query(
          `UPDATE events.outbox_events
           SET status = 'FAILED', last_error = $2,
               available_at = now() + ($3 * interval '1 second')
           WHERE id = $1`,
          [event.id, message, delaySeconds],
        );
      }
    }
    return events.length;
  }
}
