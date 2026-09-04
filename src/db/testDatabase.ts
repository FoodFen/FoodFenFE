import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import * as schema from './schema';

/**
 * A real SQLite database for tests.
 *
 * `expo-sqlite` is a native module and cannot run under Jest, so tests use
 * better-sqlite3 against the *same* Drizzle schema and the *same* generated
 * migrations. That matters: a hand-written CREATE TABLE in a test harness
 * would drift from the migration the app actually ships, and the tests would
 * pass against a schema no device has.
 *
 * Test-only. Nothing in `app/` or `src/features/` may import this — it would
 * pull better-sqlite3 into the bundle, where it cannot run.
 */

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'drizzle');

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

/** A fresh in-memory database with every migration applied. */
export function createTestDatabase(): TestDatabase {
  const sqlite = new Database(':memory:');

  // Off by default in SQLite, and the schema leans on it for cascade deletes.
  sqlite.pragma('foreign_keys = ON');

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrations) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

    // drizzle-kit separates statements with this marker; better-sqlite3's
    // `exec` handles the rest of the multi-statement string itself.
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();

      if (trimmed) sqlite.exec(trimmed);
    }
  }

  return drizzle(sqlite, { schema });
}
