import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { UserRole } from '../domain/types.js';
import type { AuthService } from '../services/auth-service.js';
import { HttpError } from '../services/http-error.js';

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Bearer token required', 'MISSING_TOKEN');
  }
  return header.slice('Bearer '.length);
}

export function authorize(authService: AuthService, roles?: UserRole[]): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user = authService.verify(bearerToken(request));
    if (roles && !roles.includes(user.role)) {
      throw new HttpError(403, 'You do not have permission for this action', 'FORBIDDEN');
    }
    request.authUser = user;
  };
}

export function requireUser(request: FastifyRequest) {
  if (!request.authUser) {
    throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  }
  return request.authUser;
}
