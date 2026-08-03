import { EventEmitter } from 'node:events';
import Redis from 'ioredis';

export type RealtimeMessage = {
  type: string;
  occurredAt: string;
  payload: unknown;
};

export type RealtimeListener = (message: RealtimeMessage) => void;

export interface RealtimeHub {
  publish(message: RealtimeMessage): Promise<void>;
  subscribe(listener: RealtimeListener): () => void;
  close(): Promise<void>;
}

export class InMemoryRealtimeHub implements RealtimeHub {
  private readonly emitter = new EventEmitter();

  async publish(message: RealtimeMessage): Promise<void> {
    this.emitter.emit('message', message);
  }

  subscribe(listener: RealtimeListener): () => void {
    this.emitter.on('message', listener);
    return () => this.emitter.off('message', listener);
  }

  async close(): Promise<void> {
    this.emitter.removeAllListeners();
  }
}

export class RedisRealtimeHub implements RealtimeHub {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly emitter = new EventEmitter();
  private readonly channel = 'relayops:live-events';

  constructor(redisUrl: string) {
    const options = {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      retryStrategy: (attempt: number) => (attempt <= 3 ? Math.min(attempt * 100, 500) : null),
    };
    this.publisher = new Redis(redisUrl, options);
    this.subscriber = new Redis(redisUrl, options);
    this.publisher.on('error', () => undefined);
    this.subscriber.on('error', () => undefined);
    this.subscriber.on('message', (_channel, message) => {
      try {
        this.emitter.emit('message', JSON.parse(message) as RealtimeMessage);
      } catch {
        // Ignore malformed messages from an external publisher.
      }
    });
  }

  async connect(): Promise<void> {
    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    await this.subscriber.subscribe(this.channel);
  }

  async publish(message: RealtimeMessage): Promise<void> {
    await this.publisher.publish(this.channel, JSON.stringify(message));
  }

  subscribe(listener: RealtimeListener): () => void {
    this.emitter.on('message', listener);
    return () => this.emitter.off('message', listener);
  }

  async close(): Promise<void> {
    this.emitter.removeAllListeners();
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }
}
