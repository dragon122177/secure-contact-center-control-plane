import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/domain/call-state-machine.ts',
        'src/domain/routing-engine.ts',
        'src/domain/automation-engine.ts',
        'src/domain/network-policy.ts',
        'src/services/webhook-signature.ts',
      ],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
