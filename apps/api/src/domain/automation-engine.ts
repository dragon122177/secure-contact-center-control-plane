import type { AutomationCondition, ProviderWebhook } from './types.js';

type AutomationContext = {
  endedReason: string;
  queueKey: string;
  direction: string;
  status: string;
};

function compare(actual: string, condition: AutomationCondition): boolean {
  const normalizedActual = actual.toLowerCase();
  const normalizedExpected = condition.value.toLowerCase();

  switch (condition.operator) {
    case 'equals':
      return normalizedActual === normalizedExpected;
    case 'not_equals':
      return normalizedActual !== normalizedExpected;
    case 'contains':
      return normalizedActual.includes(normalizedExpected);
  }
}

export function automationMatches(
  conditions: AutomationCondition[],
  webhook: ProviderWebhook,
  status: string,
): boolean {
  const context: AutomationContext = {
    endedReason: webhook.call.endedReason ?? '',
    queueKey: webhook.call.queueKey ?? '',
    direction: webhook.call.direction,
    status,
  };

  return conditions.every((condition) => compare(context[condition.field], condition));
}
