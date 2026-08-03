import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authorize, requireUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService): void {
  app.post(
    '/api/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const body = loginSchema.parse(request.body);
      return authService.login(body.email, body.password);
    },
  );

  app.post('/api/v1/auth/live-token', { preHandler: authorize(authService) }, async (request) =>
    authService.issueLiveToken(requireUser(request)),
  );
}
