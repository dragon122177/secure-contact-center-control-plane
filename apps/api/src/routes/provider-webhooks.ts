import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PROVIDER_EVENT_TYPES } from '../domain/types.js';
import type { AppConfig } from '../config.js';
import type { OperationalMetrics } from '../services/metrics.js';
import type { ProviderEventService } from '../services/provider-event-service.js';
import { verifyProviderSignature } from '../services/webhook-signature.js';
import { HttpError } from '../services/http-error.js';

const webhookSchema = z.object({
  eventId: z.string().min(1).max(200),
  eventType: z.enum(PROVIDER_EVENT_TYPES),
  occurredAt: z.string().datetime({ offset: true }),
  call: z.object({
    providerCallId: z.string().min(1).max(200),
    direction: z.enum(['INBOUND', 'OUTBOUND']),
    from: z.string().min(1).max(80),
    to: z.string().min(1).max(80),
    queueKey: z.string().min(1).max(100).optional(),
    agentExternalId: z.string().min(1).max(100).optional(),
    endedReason: z.string().min(1).max(200).optional(),
  }),
  metadata: z.record(z.string(), z.string()).optional(),
});
const workspaceParamsSchema = z.object({ workspaceSlug: z.string().regex(/^[a-z0-9-]+$/) });

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function registerProviderWebhookRoutes(
  app: FastifyInstance,
  config: AppConfig,
  service: ProviderEventService,
  metrics: OperationalMetrics,
): void {
  app.post(
    '/api/v1/provider/webhooks/:workspaceSlug',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { workspaceSlug } = workspaceParamsSchema.parse(request.params);
      const webhook = webhookSchema.parse(request.body);
      const timestamp = headerValue(request.headers['x-relayops-timestamp']);
      const signature = headerValue(request.headers['x-relayops-signature']);

      if (
        !verifyProviderSignature({
          secret: config.providerWebhookSecret,
          signature,
          timestamp,
          payload: webhook,
          toleranceSeconds: config.providerSignatureToleranceSeconds,
        })
      ) {
        metrics.providerEvents.inc({ event_type: webhook.eventType, result: 'invalid_signature' });
        throw new HttpError(401, 'Webhook signature is invalid or expired', 'INVALID_SIGNATURE');
      }

      const result = await service.process(workspaceSlug, webhook, request.correlationId);
      metrics.providerEvents.inc({
        event_type: webhook.eventType,
        result: result.duplicate ? 'duplicate' : 'processed',
      });
      if (webhook.eventType === 'CALL_RECEIVED') {
        metrics.routingDecisions.inc({ result: result.routingDecision ? 'assigned' : 'queued' });
      }
      return reply.status(result.duplicate ? 200 : 202).send(result);
    },
  );
}
