import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).default('postgres://relayops:relayops@localhost:5432/relayops'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32).default('local-development-secret-change-me-now'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  PROVIDER_WEBHOOK_SECRET: z.string().min(16).default('local-provider-webhook-secret'),
  PROVIDER_SIGNATURE_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  KAFKA_BROKERS: z.string().default('localhost:19092'),
  KAFKA_CLIENT_ID: z.string().default('relayops-control-plane'),
  KAFKA_TOPIC: z.string().default('relayops.domain-events'),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  corsOrigins: string[];
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  providerWebhookSecret: string;
  providerSignatureToleranceSeconds: number;
  kafkaBrokers: string[];
  kafkaClientId: string;
  kafkaTopic: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);

  if (parsed.NODE_ENV === 'production' && parsed.JWT_SECRET.startsWith('local-')) {
    throw new Error('JWT_SECRET must be replaced in production');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    corsOrigins: parsed.CORS_ORIGIN.split(',').map((value) => value.trim()),
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    jwtSecret: parsed.JWT_SECRET,
    jwtExpiresIn: parsed.JWT_EXPIRES_IN,
    providerWebhookSecret: parsed.PROVIDER_WEBHOOK_SECRET,
    providerSignatureToleranceSeconds: parsed.PROVIDER_SIGNATURE_TOLERANCE_SECONDS,
    kafkaBrokers: parsed.KAFKA_BROKERS.split(',').map((value) => value.trim()),
    kafkaClientId: parsed.KAFKA_CLIENT_ID,
    kafkaTopic: parsed.KAFKA_TOPIC,
  };
}
