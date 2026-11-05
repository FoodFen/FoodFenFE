import { lt, sql } from 'drizzle-orm';

import { foodsApi } from '@/api/endpoints/foods';
import type { RemoteCatalogFood } from '@/api/schemas';
import { db } from '@/db/client';
import { catalogFood } from '@/db/schema';
import { env } from '@/lib/env';
import { localData, StorageKeys } from '@/lib/storage';

import { applyCatalogOverlay, BUNDLE_SNAPSHOT_AT, parseServerTime } from './foodCatalog';

/**
 * Pulls admin catalog changes (`GET /foods?updatedSince=`) into the
 * `catalog_food` overlay table that `foodCatalog.ts` merges over the bundle.
 *
 * Public data: no auth, runs for guests, skipped when no backend is configured.
 * The cursor is the server's own `serverTime`, kept in `localData`; the first
 * one is the bundle's `snapshotAt`. A failed fetch writes nothing, so the
 * overlay and cursor stay as they were and the next trigger retries. The
 * throttle only starts after a success.
 */

const THROTTLE_MS = 10 * 60 * 1000;

let lastSuccessAt = 0;
let inFlight: Promise<boolean> | null = null;

function readOverlay(): RemoteCatalogFood[] {
  return db
    .select({ payload: catalogFood.payload })
    .from(catalogFood)
    .all()
    .map((row) => JSON.parse(row.payload) as RemoteCatalogFood);
}

/** Run once after migrations: drop rows an app update's fresher bundle already covers, then load the overlay. */
export function loadCatalogOverlay(): void {
  const snapshotMs = parseServerTime(BUNDLE_SNAPSHOT_AT);

  db.delete(catalogFood).where(lt(catalogFood.updatedAt, new Date(snapshotMs))).run();

  const cursor = localData.get<string>(StorageKeys.catalogCursor);
  if (!cursor || parseServerTime(cursor) < snapshotMs) {
    localData.set(StorageKeys.catalogCursor, BUNDLE_SNAPSHOT_AT);
  }

  applyCatalogOverlay(readOverlay());
}

async function run(): Promise<boolean> {
  const cursor = localData.get<string>(StorageKeys.catalogCursor) ?? BUNDLE_SNAPSHOT_AT;
  const { foods, serverTime } = await foodsApi.list(cursor);

  if (foods.length > 0) {
    db.transaction(() => {
      for (const food of foods) {
        const row = {
          slug: food.slug,
          payload: JSON.stringify(food),
          updatedAt: new Date(parseServerTime(food.updatedAt)),
        };

        db.insert(catalogFood)
          .values(row)
          .onConflictDoUpdate({
            target: catalogFood.slug,
            set: { payload: sql`excluded.payload`, updatedAt: sql`excluded.updated_at` },
          })
          .run();
      }
    });
    applyCatalogOverlay(readOverlay());
  }

  localData.set(StorageKeys.catalogCursor, serverTime);
  lastSuccessAt = Date.now();

  return foods.length > 0;
}

/** Resolves true when rows were written. Callers fire-and-forget and `.catch()`. */
export function syncCatalog(): Promise<boolean> {
  if (!env.hasBackend || inFlight || Date.now() - lastSuccessAt < THROTTLE_MS) {
    return Promise.resolve(false);
  }

  inFlight = run().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
