import { loadConfig } from '../config.js';
import { Database } from '../database/client.js';
import { migrateDatabase } from '../database/migrator.js';

const config = loadConfig();
const database = new Database(config.databaseUrl);

try {
  const applied = await migrateDatabase(database);
  if (applied.length === 0) {
    console.log('Database is already up to date.');
  } else {
    console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`);
  }
} finally {
  await database.close();
}
