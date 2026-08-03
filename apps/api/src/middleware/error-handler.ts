import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { InvalidCallTransitionError } from '../domain/call-state-machine.js';
import { HttpError } from '../services/http-error.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | HttpError | ZodError, request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof HttpError) {
        return reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message, details: error.details },
          correlationId: request.correlationId,
        });
      }

      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.issues,
          },
          correlationId: request.correlationId,
        });
      }

      if (error instanceof InvalidCallTransitionError) {
        return reply.status(409).send({
          error: { code: 'INVALID_CALL_TRANSITION', message: error.message },
          correlationId: request.correlationId,
        });
      }

      request.log.error({ err: error, correlationId: request.correlationId }, 'request failed');
      const statusCode = 'statusCode' in error && error.statusCode ? error.statusCode : 500;
      return reply.status(statusCode).send({
        error: {
          code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
          message: statusCode >= 500 ? 'An unexpected error occurred' : error.message,
        },
        correlationId: request.correlationId,
      });
    },
  );
}
