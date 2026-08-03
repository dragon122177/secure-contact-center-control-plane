import { Kafka, logLevel, type Producer } from 'kafkajs';
import type { AppConfig } from '../config.js';

export type PublishableEvent = {
  id: string;
  eventType: string;
  aggregateId: string;
  workspaceId: string;
  correlationId: string;
  payload: unknown;
  createdAt: string;
};

export interface EventBus {
  connect(): Promise<void>;
  publish(event: PublishableEvent): Promise<void>;
  close(): Promise<void>;
}

export class KafkaEventBus implements EventBus {
  private readonly kafka: Kafka;
  private readonly producer: Producer;

  constructor(private readonly config: AppConfig) {
    this.kafka = new Kafka({
      clientId: config.kafkaClientId,
      brokers: config.kafkaBrokers,
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 8 },
    });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true, idempotent: true });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async publish(event: PublishableEvent): Promise<void> {
    await this.producer.send({
      topic: this.config.kafkaTopic,
      acks: -1,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            'event-type': event.eventType,
            'workspace-id': event.workspaceId,
            'correlation-id': event.correlationId,
          },
        },
      ],
    });
  }

  async close(): Promise<void> {
    await this.producer.disconnect();
  }
}
