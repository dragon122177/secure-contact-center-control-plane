import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { Database } from './database/client.js';
import { migrateDatabase } from './database/migrator.js';
import {
  InMemoryRealtimeHub,
  RedisRealtimeHub,
  type RealtimeHub,
} from './services/realtime-hub.js';

const config = loadConfig();
const database = new Database(config.databaseUrl);
let realtimeHub: RealtimeHub;

await migrateDatabase(database);
const redisRealtimeHub = new RedisRealtimeHub(config.redisUrl);
try {
  await redisRealtimeHub.connect();
  realtimeHub = redisRealtimeHub;
} catch (error) {
  console.warn({ error }, 'Redis unavailable; using single-instance realtime fan-out');
  await redisRealtimeHub.close().catch(() => undefined);
  realtimeHub = new InMemoryRealtimeHub();
}
const app = await buildApp({ config, database, realtimeHub });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'graceful shutdown started');
  await app.close();
  await Promise.allSettled([realtimeHub.close(), database.close()]);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, 'RelayOps API failed to start');
  await Promise.allSettled([realtimeHub.close(), database.close()]);
  process.exitCode = 1;
}
