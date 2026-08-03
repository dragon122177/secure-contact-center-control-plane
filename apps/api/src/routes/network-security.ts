import { isIP } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authorize, requireUser } from '../middleware/auth.js';
import { auditContext, type AuditService } from '../services/audit-service.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

const sessionSchema = z.object({
  agentId: z.string().uuid(),
  sourceIp: z.string().refine((value) => isIP(value) !== 0, 'Invalid IP address'),
  deviceId: z.string().min(1).max(200).optional(),
  managedDevice: z.boolean(),
});
const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

export function registerNetworkSecurityRoutes(
  app: FastifyInstance,
  authService: AuthService,
  repository: ControlPlaneRepository,
  auditService: AuditService,
): void {
  app.get(
    '/api/v1/security/network-policies',
    { preHandler: authorize(authService) },
    async (request) => {
      const user = requireUser(request);
      return { items: await repository.listNetworkPolicies(user.workspaceId) };
    },
  );

  app.get(
    '/api/v1/security/network-sessions',
    { preHandler: authorize(authService) },
    async (request) => {
      const user = requireUser(request);
      const { limit } = listSchema.parse(request.query);
      return { items: await repository.listNetworkSessions(user.workspaceId, limit) };
    },
  );

  app.post(
    '/api/v1/security/network-sessions/validate',
    { preHandler: authorize(authService, ['ADMIN', 'SUPERVISOR']) },
    async (request, reply) => {
      const user = requireUser(request);
      const body = sessionSchema.parse(request.body);
      const result = await repository.validateNetworkSession({
        workspaceId: user.workspaceId,
        ...body,
      });
      await auditService.record({
        user,
        action: 'NETWORK_ACCESS_EVALUATED',
        resourceType: 'network_session',
        resourceId: String(result.id),
        correlationId: request.correlationId,
        afterState: { decision: result.decision, reason: result.reason, agentId: body.agentId },
        ...auditContext(request),
      });
      return reply.status(201).send(result);
    },
  );
}
