import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    worker: 'src/worker.ts',
    'commands/migrate': 'src/commands/migrate.ts',
    'commands/seed': 'src/commands/seed.ts',
  },
  clean: true,
  format: ['esm'],
  minify: false,
  sourcemap: true,
  splitting: false,
  target: 'node22',
});
