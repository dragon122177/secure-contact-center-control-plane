import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authorize, requireUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().min(1).max(100).optional(),
});

export function registerAuditRoutes(
  app: FastifyInstance,
  authService: AuthService,
  repository: ControlPlaneRepository,
): void {
  app.get(
    '/api/v1/audit/events',
    { preHandler: authorize(authService, ['ADMIN', 'SUPERVISOR', 'AUDITOR']) },
    async (request) => {
      const user = requireUser(request);
      const query = auditQuerySchema.parse(request.query);
      return {
        items: await repository.listAuditEvents(user.workspaceId, query.limit, query.action),
      };
    },
  );
}
