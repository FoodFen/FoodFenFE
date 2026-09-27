import { onlineManager } from '@tanstack/react-query';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  activityLog,
  coinTransaction,
  dailyGoal,
  foodEntry,
  ingredient,
  quest,
  streak,
  subscription,
  user,
  waterLog,
  weightLog,
} from '@/db/schema';
import { env } from '@/lib/env';

/**
 * How local and remote relate.
 *
 * The device database is authoritative for writes and always readable. The
 * server, when there is one and the user has signed in for it, is a faster
 * path for reads and eventually the place changes are pushed to.
 *
 *   read  → try remote when usable, fall back to local on any failure
 *   write → local always, marked unsynced for a later push
 *
 * That ordering is what makes the app work identically with no account, no
 * connection, or both. Nothing here blocks on the network: a read that cannot
 * reach the server returns local data instead of an error, so a screen never
 * shows a failure for something it already has on disk.
 *
 * The push half — draining `pendingChangeCount()` to the server — is not built
 * yet. Everything it needs is in place: `touch()` marks each write, and the
 * `synced_at` column says what has not landed.
 */

/**
 * Whether there is a signed-in session, wired in by `connectAuthToSync()` at
 * startup.
 *
 * The data layer sits *under* `src/features/`, so this file cannot import the
 * auth store directly without inverting that layering — instead it exposes a
 * setter, the same registration pattern `src/api/client.ts` uses for its
 * auth headers, and `src/features/auth/store.ts` calls it with its own state.
 */
let hasActiveSession: () => boolean = () => false;

export function configureSyncAuth(check: () => boolean): void {
  hasActiveSession = check;
}

/**
 * Whether the remote path is worth attempting at all.
 *
 * All three have to hold: the build knows a server URL, the user has an
 * account, and the device believes it is online. Checked before every remote
 * read so an offline or account-less user never pays for a request that is
 * certain to fail.
 */
export function canUseRemote(): boolean {
  return env.hasBackend && hasActiveSession() && onlineManager.isOnline();
}

export interface ReadOptions<T> {
  /**
   * Fetch from the server and write what comes back into the local database.
   * Omit for data the server does not hold.
   */
  pull?: () => Promise<void>;
  /** The local read. Always runs, and is always what the caller receives. */
  read: () => T;
}

/**
 * Refresh from the server when possible, then read locally — always.
 *
 * The read is deliberately not "remote value, or local on failure". The device
 * database is the thing screens render from, so the remote call's only job is
 * to bring it up to date; whatever happens, the answer is assembled from local
 * rows. That has three consequences worth the arrangement:
 *
 *   - a failed or slow server never produces an error state for data already
 *     on disk;
 *   - online and offline render the exact same code path, so the offline case
 *     cannot rot from disuse;
 *   - remote data joins against local goals, water and activity naturally,
 *     because by read time it is local data too.
 */
export async function readWithRefresh<T>({ pull, read }: ReadOptions<T>): Promise<T> {
  if (pull && canUseRemote()) {
    try {
      await pull();
    } catch (error) {
      // Deliberately swallowed: falling back to local data is the designed
      // behaviour, not a failure worth showing anyone.
      if (env.isDev) {
        console.warn('[sync] Pull failed; serving local data instead.', error);
      }
    }
  }

  return read();
}

/**
 * Stamp a row as locally modified and not yet pushed.
 *
 * Spread into every insert and update: `updatedAt` newer than `syncedAt` (or
 * `syncedAt` null) is exactly what marks a row as pending.
 */
export function touch(now: Date = new Date()): { updatedAt: Date; syncedAt: null } {
  return { updatedAt: now, syncedAt: null };
}

/** Marks a row deleted without removing it, so the deletion can be pushed. */
export function touchDeleted(now: Date = new Date()): {
  updatedAt: Date;
  syncedAt: null;
  deletedAt: Date;
} {
  return { ...touch(now), deletedAt: now };
}

/** Every table that carries sync columns, for counting pending work. */
const SYNCED_TABLES = [
  user,
  dailyGoal,
  foodEntry,
  ingredient,
  activityLog,
  weightLog,
  waterLog,
  streak,
  quest,
  coinTransaction,
  subscription,
] as const;

/**
 * How many rows are waiting to reach the server.
 *
 * Drives the "N changes pending" affordance, and is the number a future push
 * would work through.
 */
export function pendingChangeCount(): number {
  return SYNCED_TABLES.reduce((total, table) => {
    const [row] = db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(or(isNull(table.syncedAt), sql`${table.updatedAt} > ${table.syncedAt}`))
      .all();

    return total + (row?.count ?? 0);
  }, 0);
}

/**
 * Marks a row as having reached the server. Used by the future push pass.
 *
 * `remoteId` is a UUID string for every table except `user` (an integer,
 * the server's one exception to UUID primary keys) — typed as `string |
 * number` here since this function is generic over every synced table.
 */
export function markSynced(
  table: (typeof SYNCED_TABLES)[number],
  id: string,
  remoteId?: string | number,
): void {
  db.update(table)
    .set({
      syncedAt: new Date(),
      ...(remoteId === undefined ? {} : { remoteId: remoteId as never }),
    })
    .where(eq(table.id, id))
    .run();
}

/** Rows that are live: not soft-deleted. Composed into every read. */
export function notDeleted<T extends { deletedAt: unknown }>(table: T) {
  return isNull(table.deletedAt as Parameters<typeof isNull>[0]);
}

/** Convenience for the very common "this user's live rows" filter. */
export function ownedBy<T extends { userId: unknown; deletedAt: unknown }>(
  table: T,
  userId: string,
) {
  return and(eq(table.userId as Parameters<typeof eq>[0], userId), notDeleted(table));
}
