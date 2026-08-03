import type { FastifyInstance } from 'fastify';
import { authorize, requireUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

export function registerDashboardRoutes(
  app: FastifyInstance,
  authService: AuthService,
  repository: ControlPlaneRepository,
): void {
  app.get('/api/v1/dashboard', { preHandler: authorize(authService) }, async (request) => {
    const user = requireUser(request);
    return repository.dashboard(user.workspaceId);
  });
}
