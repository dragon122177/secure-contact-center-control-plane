import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from './client.js';

async function resolveMigrationDirectory(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), 'database/migrations'),
    path.resolve(process.cwd(), '../../database/migrations'),
    fileURLToPath(new URL('../../../../database/migrations/', import.meta.url)),
    fileURLToPath(new URL('../../../database/migrations/', import.meta.url)),
  ];

  for (const candidate of [...new Set(candidates)]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next layout (source, workspace script, or bundled runtime).
    }
  }
  throw new Error(`Migration directory not found. Checked: ${candidates.join(', ')}`);
}

function checksum(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

export async function migrateDatabase(database: Database): Promise<string[]> {
  const migrationDirectory = await resolveMigrationDirectory();
  await database.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const filenames = (await readdir(migrationDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  const applied: string[] = [];

  await database.query('SELECT pg_advisory_lock($1)', [771_029_441]);
  try {
    for (const filename of filenames) {
      const sql = await readFile(path.join(migrationDirectory, filename), 'utf8');
      const currentChecksum = checksum(sql);
      const existing = await database.query<{ checksum: string }>(
        'SELECT checksum FROM public.schema_migrations WHERE filename = $1',
        [filename],
      );

      if (existing.rowCount === 1) {
        if (existing.rows[0]?.checksum !== currentChecksum) {
          throw new Error(`Applied migration ${filename} has changed`);
        }
        continue;
      }

      await database.transaction(async (client) => {
        await client.query("SET LOCAL lock_timeout = '10s'");
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, currentChecksum],
        );
      });
      applied.push(filename);
    }
  } finally {
    await database.query('SELECT pg_advisory_unlock($1)', [771_029_441]);
  }

  return applied;
}
