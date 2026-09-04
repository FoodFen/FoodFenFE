import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

/**
 * The on-device database.
 *
 * Opened synchronously at module load so repositories can be plain functions
 * rather than everything awaiting a connection. `enableChangeListener` powers
 * `useLiveQuery`, which lets a screen re-render when a write lands without
 * needing to be told to refetch.
 *
 * Migrations do NOT run here — `useDatabaseMigrations` runs them from the root
 * layout, before any screen mounts, so a query can never hit a table that does
 * not exist yet.
 */
export const sqliteDatabase = openDatabaseSync('foodfen.db', {
  enableChangeListener: true,
});

export const db = drizzle(sqliteDatabase, { schema });

export type Database = typeof db;

/**
 * Foreign keys are off by default in SQLite and must be enabled per
 * connection. Without this, `onDelete: 'cascade'` silently does nothing and
 * deleting an entry would orphan its ingredients.
 */
export function enableForeignKeys(): void {
  sqliteDatabase.execSync('PRAGMA foreign_keys = ON;');
}

/** Wipes every table. Backs the "erase local data" action. */
export function eraseDatabase(): void {
  sqliteDatabase.execSync(`
    DELETE FROM ingredient;
    DELETE FROM food_entry;
    DELETE FROM daily_goal;
    DELETE FROM activity_log;
    DELETE FROM weight_log;
    DELETE FROM water_log;
    DELETE FROM quest;
    DELETE FROM coin_transaction;
    DELETE FROM streak;
    DELETE FROM subscription;
    DELETE FROM user;
  `);
}
