import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../services/auth-service.js';
import type { RealtimeHub } from '../services/realtime-hub.js';

const liveQuerySchema = z.object({ token: z.string().min(1) });

export function registerLiveRoute(
  app: FastifyInstance,
  authService: AuthService,
  realtimeHub: RealtimeHub,
): void {
  app.get('/live', { websocket: true }, (socket, request) => {
    try {
      const { token } = liveQuerySchema.parse(request.query);
      const user = authService.verifyLiveToken(token);
      socket.send(
        JSON.stringify({
          type: 'CONNECTED',
          occurredAt: new Date().toISOString(),
          payload: { workspaceId: user.workspaceId },
        }),
      );
      const unsubscribe = realtimeHub.subscribe((message) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      });
      socket.on('close', unsubscribe);
      socket.on('error', unsubscribe);
    } catch {
      socket.close(1008, 'Authentication required');
    }
  });
}
