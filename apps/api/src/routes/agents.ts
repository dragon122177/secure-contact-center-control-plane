import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AGENT_PRESENCES } from '../domain/types.js';
import { authorize, requireUser } from '../middleware/auth.js';
import { auditContext, type AuditService } from '../services/audit-service.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';
import type { RealtimeHub } from '../services/realtime-hub.js';

const agentParamsSchema = z.object({ id: z.string().uuid() });
const presenceSchema = z.object({ presence: z.enum(AGENT_PRESENCES) });

export function registerAgentRoutes(
  app: FastifyInstance,
  authService: AuthService,
  repository: ControlPlaneRepository,
  auditService: AuditService,
  realtimeHub: RealtimeHub,
): void {
  app.get('/api/v1/agents', { preHandler: authorize(authService) }, async (request) => {
    const user = requireUser(request);
    return { items: await repository.listAgents(user.workspaceId) };
  });

  app.patch(
    '/api/v1/agents/:id/presence',
    { preHandler: authorize(authService, ['ADMIN', 'SUPERVISOR']) },
    async (request) => {
      const user = requireUser(request);
      const { id } = agentParamsSchema.parse(request.params);
      const { presence } = presenceSchema.parse(request.body);
      const result = await repository.updateAgentPresence(
        user.workspaceId,
        id,
        presence,
        async (transaction, change) =>
          auditService.record(
            {
              user,
              action: 'AGENT_PRESENCE_CHANGED',
              resourceType: 'agent',
              resourceId: id,
              correlationId: request.correlationId,
              beforeState: change.before,
              afterState: change.after,
              ...auditContext(request),
            },
            transaction,
          ),
      );
      try {
        await realtimeHub.publish({
          type: 'AGENT_PRESENCE_CHANGED',
          occurredAt: new Date().toISOString(),
          payload: result.after,
        });
      } catch (error) {
        request.log.warn({ err: error }, 'realtime agent update could not be published');
      }
      return result.after;
    },
  );
}
