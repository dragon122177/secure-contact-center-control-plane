import type { FastifyInstance } from 'fastify';
import { authorize, requireUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

export function registerQueueRoutes(
  app: FastifyInstance,
  authService: AuthService,
  repository: ControlPlaneRepository,
): void {
  app.get('/api/v1/queues', { preHandler: authorize(authService) }, async (request) => {
    const user = requireUser(request);
    return { items: await repository.listQueues(user.workspaceId) };
  });
}
