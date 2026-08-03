import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export class OperationalMetrics {
  readonly registry = new Registry();
  readonly httpDuration: Histogram<'method' | 'route' | 'status_code'>;
  readonly providerEvents: Counter<'event_type' | 'result'>;
  readonly routingDecisions: Counter<'result'>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'relayops_' });
    this.httpDuration = new Histogram({
      name: 'relayops_http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
    this.providerEvents = new Counter({
      name: 'relayops_provider_events_total',
      help: 'Provider webhook events processed by result',
      labelNames: ['event_type', 'result'],
      registers: [this.registry],
    });
    this.routingDecisions = new Counter({
      name: 'relayops_routing_decisions_total',
      help: 'Routing decisions by assignment result',
      labelNames: ['result'],
      registers: [this.registry],
    });
  }
}
