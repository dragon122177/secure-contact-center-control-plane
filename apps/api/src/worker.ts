import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from './config.js';
import { Database } from './database/client.js';
import { KafkaEventBus } from './services/event-bus.js';
import { AutomationWorker } from './workers/automation-worker.js';
import { OutboxWorker } from './workers/outbox-worker.js';

const config = loadConfig();
const database = new Database(config.databaseUrl);
const eventBus = new KafkaEventBus(config);
const outboxWorker = new OutboxWorker(database, eventBus);
const automationWorker = new AutomationWorker(database);
let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log({ signal }, 'worker shutdown requested');
  await Promise.allSettled([eventBus.close(), database.close()]);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await eventBus.connect();
console.log('RelayOps worker connected to the event bus.');

while (!stopping) {
  try {
    const [outboxCount, automationCount] = await Promise.all([
      outboxWorker.runOnce(),
      automationWorker.runOnce(),
    ]);
    if (outboxCount === 0 && automationCount === 0) await delay(1_000);
  } catch (error) {
    console.error({ error }, 'worker iteration failed');
    await delay(2_000);
  }
}
