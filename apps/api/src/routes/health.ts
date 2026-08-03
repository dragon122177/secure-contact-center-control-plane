import type { FastifyInstance } from 'fastify';
import type { Database } from '../database/client.js';
import type { OperationalMetrics } from '../services/metrics.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  database: Database,
  metrics: OperationalMetrics,
): void {
  app.get('/health/live', async () => ({ status: 'ok', service: 'relayops-api' }));

  app.get('/health/ready', async (_request, reply) => {
    const databaseReady = await database.isReady();
    const status = databaseReady ? 'ready' : 'not_ready';
    return reply
      .status(databaseReady ? 200 : 503)
      .send({ status, checks: { database: databaseReady } });
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', metrics.registry.contentType);
    return metrics.registry.metrics();
  });
}
