import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';
import type { Database } from './database/client.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAutomationRoutes } from './routes/automations.js';
import { registerCallRoutes } from './routes/calls.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerLiveRoute } from './routes/live.js';
import { registerNetworkSecurityRoutes } from './routes/network-security.js';
import { registerProviderWebhookRoutes } from './routes/provider-webhooks.js';
import { registerQueueRoutes } from './routes/queues.js';
import { AuditService } from './services/audit-service.js';
import { AuthService } from './services/auth-service.js';
import { ControlPlaneRepository } from './services/control-plane-repository.js';
import { OperationalMetrics } from './services/metrics.js';
import { ProviderEventService } from './services/provider-event-service.js';
import type { RealtimeHub } from './services/realtime-hub.js';

export type AppDependencies = {
  config: AppConfig;
  database: Database;
  realtimeHub: RealtimeHub;
};

function validCorrelationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const { config, database, realtimeHub } = dependencies;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.x-relayops-signature',
          'password',
          '*.password',
          '*.callerNumber',
          '*.destinationNumber',
        ],
        censor: '[REDACTED]',
      },
    },
    trustProxy: true,
  });

  app.decorateRequest('correlationId', '');
  app.addHook('onRequest', async (request, reply) => {
    const supplied = request.headers['x-correlation-id'];
    request.correlationId = validCorrelationId(supplied) ? supplied : randomUUID();
    reply.header('x-correlation-id', request.correlationId);
  });

  await app.register(cors, { origin: config.corsOrigins, credentials: false });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  const authService = new AuthService(database, config);
  const repository = new ControlPlaneRepository(database);
  const auditService = new AuditService(database);
  const metrics = new OperationalMetrics();
  const providerEventService = new ProviderEventService(database, realtimeHub);

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unmatched';
    metrics.httpDuration.observe(
      { method: request.method, route, status_code: String(reply.statusCode) },
      reply.elapsedTime / 1000,
    );
  });

  registerHealthRoutes(app, database, metrics);
  registerAuthRoutes(app, authService);
  registerDashboardRoutes(app, authService, repository);
  registerAgentRoutes(app, authService, repository, auditService, realtimeHub);
  registerQueueRoutes(app, authService, repository);
  registerCallRoutes(app, authService, repository);
  registerAutomationRoutes(app, authService, repository, auditService);
  registerNetworkSecurityRoutes(app, authService, repository, auditService);
  registerAuditRoutes(app, authService, repository);
  registerProviderWebhookRoutes(app, config, providerEventService, metrics);
  registerLiveRoute(app, authService, realtimeHub);
  registerErrorHandler(app);

  return app;
}
