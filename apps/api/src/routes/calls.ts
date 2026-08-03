import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CALL_STATUSES } from '../domain/types.js';
import { authorize, requireUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

const listCallsSchema = z.object({
  status: z.enum(CALL_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const callParamsSchema = z.object({ id: z.string().uuid() });

export function registerCallRoutes(
  app: FastifyInstance,
  authService: AuthService,
  repository: ControlPlaneRepository,
): void {
  app.get('/api/v1/calls', { preHandler: authorize(authService) }, async (request) => {
    const user = requireUser(request);
    const query = listCallsSchema.parse(request.query);
    return repository.listCalls(user.workspaceId, query.status, query.limit, query.offset);
  });

  app.get('/api/v1/calls/:id/events', { preHandler: authorize(authService) }, async (request) => {
    const user = requireUser(request);
    const { id } = callParamsSchema.parse(request.params);
    return { items: await repository.callEvents(user.workspaceId, id) };
  });
}
