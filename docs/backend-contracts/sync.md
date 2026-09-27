# Diary/log sync — API contract

No design spec companion — the design *is* `CLAUDE.md`'s "Local-first is the
design, not a fallback" section and `src/data/sync.ts`'s own doc comment;
this file is the wire contract built against that. Two different things are
documented here under one roof because they're two halves of the same
mechanism:

- **Pull** (`GET` reads) is **already shipped and calling real code paths**
  today — `src/data/sync.ts`'s `readWithRefresh()`, `src/data/pull.ts`,
  `src/api/endpoints/sync.ts`. It has just never had a contract doc, and
  every call currently fails silently (`canUseRemote()` is false with no
  backend deployed, so the client falls back to local data — see Context).
  Treat this half as "confirm/implement to match," not a design proposal.
- **Push** (drain `pendingChangeCount()` to the server) **does not exist on
  either side yet.** `touch()`/`touchDeleted()` already mark every local
  write dirty, and `markSynced()` exists to clear that mark — nothing calls
  it. This half is a genuine design, not documentation of shipped behavior.

If a change is needed here, it should come back to a client-side update, not
a silent divergence, same as every other contract in this folder.

## Context

The device SQLite database is the source of truth (`src/db/schema.ts`,
`CLAUDE.md`). The app is fully usable with no account and no connection; a
server is an accelerator and a backup, never a requirement. Concretely:

- **Reads**: `readWithRefresh({ pull, read })` optionally calls `pull` (one
  of the endpoints below) when `canUseRemote()` — backend configured,
  signed-in session, online — then **always** answers from the local
  database, pull success or failure. A slow or unreachable server never
  produces an error state for data already on disk.
- **Writes**: local and immediate. Every insert/update spreads `touch()`
  (`updated_at` now, `synced_at` null); every delete is soft, via
  `touchDeleted()` (adds `deleted_at`). "Rows the server hasn't seen yet" is
  a query, not a queue: `src/data/sync.ts`'s `pendingChangeCount()` counts
  rows across `SYNCED_TABLES` where `synced_at` is null or older than
  `updated_at`.
- **Pull never overwrites a dirty row.** `src/data/pull.ts`'s `isDirty()`
  check skips any local row with an unsynced edit rather than clobbering it
  with the server's version. That row is push's job once push exists —
  today it just sits unsynced until the user edits it again or push lands.

## ID types — read this before implementing anything below

Every table in `SYNCED_TABLES` uses a **locally generated string id**
(`src/lib/id.ts`'s `generateLocalId()`) as its primary key, plus a nullable
`remote_id` column the server's id fills in once a row is pushed. Per the
backend's own UUID-PK convention (confirmed directly with that session —
`user` is the sole integer-PK exception), **every `remoteId`/`id` in this
contract is a string (UUID), except `User.id`, which stays an integer.**

This contract is written assuming that type is correct throughout. It is
**not yet correct in the client code this contract otherwise describes**:
`src/db/schema.ts`'s `remoteId: integer('remote_id')` and every non-user `id:
z.number().int()` in `src/api/schemas.ts` (`foodEntrySchema`,
`ingredientSchema`, `dailyGoalSchema`, `activityLogSchema`,
`weightLogSchema`, `waterLogSchema`) still say integer. That's a client-side
fix to land before or alongside whatever the backend session builds from
this doc — flagged here rather than silently assumed away, since a session
building the backend from this file would otherwise reasonably expect the
client already matches it.

## Auth

Identical to every other authenticated endpoint (`auth.md`): `Authorization:
Bearer <accessToken>`, standard `401` handling (client retries once after a
refresh). `userId`/ownership is **never a request field** on anything
below — inferred from the token, exactly like every other endpoint in this
API. No `skipAuth` endpoints in this contract.

---

## Pull — reading server state into the device

One `GET` per resource, called from `src/data/pull.ts`. Each response is an
array; the client upserts by matching `remote_id`, skipping any row that is
currently dirty (see Context). **None of these currently return deleted
rows, and the client has no way to apply a remote deletion** — a row deleted
on another device is never reconciled on this one today. That's a real gap,
explicitly out of scope for this pass (see "Left to the backend session's
own judgment").

### `GET /users/me`

Response `200`: the `User` object exactly as `auth.md` defines it. Used to
refresh the client's copy of body stats/preferences/`subscriptionTier`
without re-authenticating. (Already specified in `auth.md`; repeated here
only because `src/data/pull.ts` doesn't currently call it — `syncApi.me()`
exists but is unused. Worth knowing the client has this gap too.)

Verified live against a fresh sign-up: `gender`, `birthYear`, `height`,
`weightCurrent`, `weightGoal`, `activityLevel`, `dietType`,
`calorieLeftMode`, `weeklyRateKg` all come back `null` before that profile
data has ever been pushed — which, since push doesn't exist yet, is every
account today, not an edge case. `userSchema` (`src/api/schemas.ts`) now
accepts `null` on all of those; it previously required them, which failed
validation on literally the first real account tested against it. Nothing
in the client reads these fields off the server's copy anyway (the local
profile is authoritative — `CLAUDE.md`), so this was purely a schema-vs-
reality bug, not a design question.

### `GET /daily-goals`

Response `200`: array of
```json
{
  "id": "string",
  "userId": 0,
  "targetKcal": 0,
  "targetCarbsG": 0,
  "targetProteinG": 0,
  "targetFatG": 0,
  "targetWaterMl": 0,
  "effectiveDate": "yyyy-MM-dd"
}
```
Every goal ever set for the account, not filtered by date range — goals are
append-only and few in number (one per profile/target change), so the
client pulls the whole history and resolves "today's goal" itself (newest
row effective on or before the day in question).

### `GET /food-entries?from=yyyy-MM-dd&to=yyyy-MM-dd`

Response `200`: array of
```json
{
  "id": "string",
  "userId": 0,
  "name": "string",
  "inputMethod": "voice" | "image" | "type" | "manual",
  "imageUrl": "string | null",
  "totalKcal": 0,
  "carbsG": 0,
  "proteinG": 0,
  "fatG": 0,
  "fiberG": 0,
  "aiFeedback": "up" | "down" | null,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "loggedAt": "iso-datetime",
  "loggedOn": "yyyy-MM-dd",
  "ingredients": [
    {
      "id": "string",
      "foodEntryId": "string",
      "name": "string",
      "quantityG": 0,
      "kcal": 0,
      "carbsG": 0,
      "proteinG": 0,
      "fatG": 0,
      "fiberG": 0
    }
  ]
}
```
Inclusive day range. `ingredients` is the complete, authoritative set for
that entry — the client deletes its local ingredient rows for the entry and
re-inserts this array rather than merging, so a stale local ingredient never
survives a pull. **`fiberG` must never be tier-stripped** — already fixed
per the `POST /food-entries` change (`CreateFoodEntryUseCase` no longer
takes `is_premium`); this is the same rule applied to reads.

### `GET /activity-logs?from=yyyy-MM-dd&to=yyyy-MM-dd`

Response `200`: array of
```json
{
  "id": "string",
  "userId": 0,
  "activityType": "string",
  "caloriesBurned": 0,
  "source": "manual" | "apple_health" | "google_fit",
  "loggedAt": "iso-datetime",
  "loggedOn": "yyyy-MM-dd"
}
```

### `GET /water-logs?from=yyyy-MM-dd&to=yyyy-MM-dd`

Response `200`: array of
```json
{ "id": "string", "userId": 0, "amountMl": 0, "loggedAt": "iso-datetime", "loggedOn": "yyyy-MM-dd" }
```

### `GET /weight-logs?from=yyyy-MM-dd&to=yyyy-MM-dd`

Response `200`: array of
```json
{ "id": "string", "userId": 0, "weight": 0, "recordedAt": "yyyy-MM-dd" }
```
`recordedAt` is a date, not a datetime — one weight per day, keyed by date.

---

## Push — writing device state to the server

Doesn't exist client-side yet; this is what it will call once built. **Per
resource, matching what the client already writes locally** — not a single
batch envelope, deliberately: `POST /food-entries` already exists and is
real, tested backend code, and this contract is written to extend that
pattern rather than replace it with something new to redo. The client-side
scheduler that decides *when* to call these (on local write, app
foreground, reconnect — draining `pendingChangeCount()` oldest-first) isn't
built either; expect small, frequent requests (a handful of rows at a time),
not bulk uploads, mirroring how pull already fetches modest date ranges
rather than a full history dump.

### Shared rules for every endpoint below

- **Idempotency.** Every create body includes `clientId` — the row's local
  id string, `entry_xxx`/`goal_xxx`/etc. from `generateLocalId()`. It is
  never the row's real identity (that's the server's own `id`/`remote_id`
  once assigned) — it exists purely so a retried request after a dropped
  response doesn't create a duplicate. A `POST` whose `clientId` the server
  has already seen for this account must return the existing row, not
  create a second one.
- **Response shape.** Every create/update returns the full canonical row —
  the same shape the matching `GET` above returns — not just the assigned
  id, so the client can reconcile any server-computed/normalized field in
  one round trip.
- **Ownership.** `userId` is inferred from the bearer token, never sent.
- **Soft delete.** `DELETE` marks the row deleted server-side; never a hard
  delete. (What a subsequent `GET` does about a deleted row is the pull-side
  gap noted above — unresolved by this contract.)
- **Conflicts.** The client never overwrites its own dirty row from a pull,
  so from the client's side there's no "whose edit wins" question *within
  one device*. **Across two devices editing the same row while both were
  offline, this contract does not define a resolution** — left to the
  backend session's judgment (last-push-wins is a reasonable default given
  the product's current single-primary-device usage).

### User

`PATCH /users/me` — profile edits (body stats, goals, preferences) made
while offline or before an account existed.

Request: every `User` field from `auth.md` **except** `id`, `createdAt`,
and — this one matters — **`subscriptionTier`**. That field is never
client-settable via this endpoint; it only ever changes through
`premium-entitlements.md`'s billing flow. A profile-sync endpoint that also
accepted `subscriptionTier` would let a client grant itself Premium for
free.

Response `200`: the full `User` object.

### Daily goals

**Correction to an earlier version of this section**, found while wiring
push: this is upsert-on-`(user, effectiveDate)`, not strictly append-only.
`userRepository.setGoal()` replaces the existing row for that exact
`effectiveDate` if one exists — a user tuning their target a few times in
one sitting gets one row for today, not a paper trail of same-day
corrections — and only becomes immutable once a later day makes it history.
That's the actual invariant behind `CLAUDE.md`'s "changing today's target
never rewrites what **last week** was measured against": past days are
protected, today is not. `POST /daily-goals` should upsert on
`(userId, effectiveDate)` — same `clientId` with the same `effectiveDate`
replaces the existing row's values rather than being treated as a stale
duplicate; a different `effectiveDate` is always a new row, never touching
an older one.

Request: `clientId`, `targetKcal`, `targetCarbsG`, `targetProteinG`,
`targetFatG`, `targetWaterMl`, `effectiveDate`.

Response `200`: the full `DailyGoal` object (with server `id`).

### Streak

**New since the last version of this doc.** `streak` carries the same sync
columns as every other table but was missing from the client's
`SYNCED_TABLES` list — a client-side oversight this doc used to flag as FYI
without asking for backend work. Now fixed on the client, so this needs a
real endpoint.

`recordActiveDay()` maintains exactly one row per account — `currentStreak`,
`longestStreak`, `lastActiveDate` — incrementally, not derived from
`food_entry`/`activity_log` history at read time. Without syncing it, two
devices logging on different days would each keep their own, possibly-wrong
streak count.

`POST /streak` only — upserts the account's one row, same spirit as daily
goals but keyed on the account itself rather than `(user, effectiveDate)`,
since there is exactly one row, ever. No `clientId`: retrying the same
numbers is already idempotent (upserting identical values twice is a no-op
either way), so there's no "which one" for an id to disambiguate.

Request: `currentStreak`, `longestStreak`, `lastActiveDate` (`yyyy-MM-dd` or
`null` — a fresh account has never logged anything).

Response `200`: `{ id, userId, currentStreak, longestStreak, lastActiveDate }`
(with server `id`, assigned on the first-ever push).

### Food entries (+ ingredients)

Already exists (`POST /food-entries`, `GET /food-entries/{id}`) —
this section is confirming the shape against the rest of this contract,
not asking for new work, plus naming the two pieces still missing:

- `POST /food-entries` — request: `clientId` + every `FoodEntry` field
  from the `GET` shape above except `id`/`userId`, with `ingredients` as an
  array of `{ clientId, name, quantityG, kcal, carbsG, proteinG, fatG,
  fiberG }` (no ingredient-level id needed on create).
- `PATCH /food-entries/{id}` *(not yet built, per your message)* — same
  body shape, for `updateEntry`/`updateManualEntry`'s local edits after
  initial creation. `ingredients` is again the complete, replacing set —
  mirror pull's "delete then re-insert" semantics rather than diffing, so
  the two directions stay symmetric.
- `DELETE /food-entries/{id}` *(not yet built)* — soft delete, for
  `deleteEntry`.

### Activity logs

- `POST /activity-logs` — `clientId`, `activityType`, `caloriesBurned`,
  `source`, `loggedAt`, `loggedOn`.
- `PATCH /activity-logs/{id}` — for `upsertHealthSteps`'s
  create-or-update-by-day pattern (an Apple Health/Google Fit step count
  gets corrected throughout the day). Same body.
- No `DELETE` — there's no local path that removes an activity log today.

### Weight logs

- `POST /weight-logs` — `clientId`, `weight`, `recordedAt`.
- No `PATCH`/`DELETE` — `logWeight` only ever creates.

### Water logs

- `POST /water-logs` — `clientId`, `amountMl`, `loggedAt`, `loggedOn`.
- `DELETE /water-logs/{id}` — for `removeLastWater` ("undo my last cup").

### Quests

Not yet documented anywhere; `src/data/gamificationRepository.ts` already
has live UI (`app/(tabs)/achievements.tsx`, `app/log/interstitial.tsx`,
`QuestToast`), so this is real current functionality, not speculative.

- `POST /quests` — a fresh daily/weekly set being issued. Body: `clientId`,
  `questType` (`log_breakfast | log_all_meals | hit_calorie_goal |
  hit_protein_goal | drink_water | log_weight | stay_active_week`),
  `target`, `rewardCoins`, `cadence` (`daily | weekly`), `completionRatio`,
  `questDate`.
- `PATCH /quests/{id}` — progress updates (`setQuestProgress`) and
  completion. Body: `progress`, `completed`.
- No `DELETE`.

### Coin transactions

`POST /coin-transactions` only — an append-only ledger
(`getCoinBalance` sums it; nothing ever edits or removes a row). Body:
`clientId`, `amount` (signed), `reason` (`quest_completed | streak_bonus |
purchase | spend | adjustment`), `createdAt`.

### Explicitly out of scope for this contract

- **`ingredient`** has no standalone endpoint — always nested inside a
  food entry, both directions.
- **`subscription`** is deliberately **not** part of this contract.
  `premium-entitlements.md` already owns that table via `GET
  /subscriptions/me` and the PayOS checkout flow; a generic sync path for
  it would let a client push its own fabricated entitlement.

## Errors

Standard error body and status mapping, same as every other endpoint in
this API:
- `400`/`422` — malformed request, field validation failure.
- `401` — see Auth above.
- `404` — `PATCH`/`DELETE` target doesn't exist, or belongs to a different
  account (treated identically, so existence isn't leaked).
- `409` — reserved for a future explicit conflict signal, if the backend
  session decides to detect rather than silently last-write-wins the
  cross-device case noted above. Nothing currently requires it.
- `429` / `5xx` — standard, generic client handling already covers both.

## Left to the backend session's own judgment

- Whether/how a pulled list surfaces a row deleted on another device (the
  "pull never sees a remote deletion" gap above) — this contract leaves it
  unsolved rather than half-specifying it.
- Multi-device conflict resolution beyond last-push-wins.
- Whether any of these ever need real batching (a single call covering
  many dirty rows at once) as a later optimization — nothing in the current
  client shape requires it, so it's not part of this pass.
- Rate limiting / abuse prevention on the push endpoints.
- The quest catalog itself (`DAILY_QUESTS`/`WEEKLY_QUESTS` in
  `gamificationRepository.ts`) is hardcoded client-side today, with a
  comment noting it should become "server-driven once a backend exists" —
  that's a distinct, larger feature (a quest-content endpoint) and not
  part of this sync contract.
