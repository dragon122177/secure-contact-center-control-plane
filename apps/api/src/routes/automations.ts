import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authorize, requireUser } from '../middleware/auth.js';
import { auditContext, type AuditService } from '../services/audit-service.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

const conditionSchema = z.object({
  field: z.enum(['endedReason', 'queueKey', 'direction', 'status']),
  operator: z.enum(['equals', 'not_equals', 'contains']),
  value: z.string().min(1).max(200),
});
const actionSchema = z.object({
  type: z.enum(['ADD_TAG', 'SET_DISPOSITION', 'NOTIFY_SUPERVISOR']),
  value: z.string().min(1).max(500),
});
const createRuleSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(500).default(''),
  triggerEvent: z.enum(['CALL_ENDED', 'CALL_ABANDONED', 'CALL_FAILED']),
  conditions: z.array(conditionSchema).max(10).default([]),
  actions: z.array(actionSchema).min(1).max(10),
});
const runsQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

export function registerAutomationRoutes(
  app: FastifyInstance,
  authService: AuthService,
  repository: ControlPlaneRepository,
  auditService: AuditService,
): void {
  app.get('/api/v1/automations/rules', { preHandler: authorize(authService) }, async (request) => {
    const user = requireUser(request);
    return { items: await repository.listAutomationRules(user.workspaceId) };
  });

  app.post(
    '/api/v1/automations/rules',
    { preHandler: authorize(authService, ['ADMIN', 'SUPERVISOR']) },
    async (request, reply) => {
      const user = requireUser(request);
      const body = createRuleSchema.parse(request.body);
      const rule = await repository.createAutomationRule({
        workspaceId: user.workspaceId,
        userId: user.id,
        ...body,
      });
      await auditService.record({
        user,
        action: 'AUTOMATION_RULE_CREATED',
        resourceType: 'automation_rule',
        resourceId: String(rule?.id),
        correlationId: request.correlationId,
        afterState: rule,
        ...auditContext(request),
      });
      return reply.status(201).send(rule);
    },
  );

  app.get('/api/v1/automations/runs', { preHandler: authorize(authService) }, async (request) => {
    const user = requireUser(request);
    const { limit } = runsQuerySchema.parse(request.query);
    return { items: await repository.listAutomationRuns(user.workspaceId, limit) };
  });
}
