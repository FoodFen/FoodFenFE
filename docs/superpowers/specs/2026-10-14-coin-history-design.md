# Coin history + idempotent redeem (app) — design

Date: 2026-10-14 · Status: approved for implementation · Backend: FoodFenBE branch `feat/coin-history`
(`docs/superpowers/specs/2026-10-14-coin-history-design.md`). Wire contract: `premium-entitlements.md`
→ `GET /coins/transactions` and `POST /coins/redeem` (`clientId`), already updated in this branch.

## Goal

From the coin shop, a user can open "Lịch sử xu" and see every coin movement (earned from quests,
quizzes, streak bonus; spent on Premium days), newest first, scrolling loads older pages. A redeem that
is retried after a network failure never spends twice. For every signed-in user, no Premium gate.

## Decisions

- **API** (`src/api/endpoints/gamification.ts`, `src/api/schemas.ts`):
  - `transactions({ before }, signal)` → `GET coins/transactions?before=` (no `limit`, server default 20),
    zod schema `{ transactions: [{ id, amount: int, reason: string, createdAt: iso }], nextCursor: string | null }`.
    `reason` is a plain `z.string()` so an unknown future reason can't fail parsing.
  - `redeemCoins(days, clientId)` sends `{ days, clientId }`.
- **Redeem key** (`app/shop.tsx` + `useRedeemCoins` in `src/features/gamification/queries.ts`): the mutation
  takes `{ days, clientId }`. The screen generates the key with `generateLocalId` per redeem attempt and keeps
  the last failed attempt in a ref: if the previous attempt for the **same `days`** failed with anything other
  than a 409 (network error, 5xx), the next tap reuses its `clientId`; a success or a 409 clears it. So a
  "spent on the server, response lost" attempt retried by the user is a replay, not a second spend.
- **Query**: `useCoinTransactions()` = `useInfiniteQuery` on a new key `queryKeys.gamification.transactions()`,
  `initialPageParam: undefined`, `getNextPageParam: nextCursor ?? undefined`, `enabled` only with a backend
  and a session (signed-out users have no server ledger: the shop row is hidden for them). Redeem success
  also invalidates this key. Server data stays in Query, never in a store; nothing is written to SQLite.
- **Screen**: new route `app/coin-history.tsx`, pushed from a new tappable row "Lịch sử xu" (chevron) in
  `app/shop.tsx` under the balance card. Mirrors `app/dish-list.tsx`'s infinite list: `FlatList`,
  `onEndReached` → `fetchNextPage` when `hasNextPage`, a footer spinner while fetching the next page,
  `RefreshControl` pull-to-refresh, `Skeleton` rows (same height as a row) on first load, `EmptyState` when
  there are no rows, `ErrorState` with retry when the first page fails.
  - Row: Ionicons icon (`add-circle` credit / `remove-circle` debit), the reason label, the local date and
    time (follow the app's existing date formatting helpers and the current locale), the amount as `+120` /
    `−600` with the success / danger tone tokens.
  - Reason labels in `src/lib/i18n/vi.ts` and `en.ts`: quest_completed "Hoàn thành nhiệm vụ" / "Quest
    completed", streak_bonus "Thưởng chuỗi ngày" / "Streak bonus", purchase "Mua xu" / "Coin purchase",
    spend "Đổi ngày Premium" / "Premium days", mascot_purchase "Mua thú cưng" / "Mascot purchase", adjustment "Điều chỉnh" / "Adjustment", quiz_daily "Quiz hằng
    ngày" / "Daily quiz", quiz_practice "Quiz luyện tập" / "Practice quiz", unknown → "Giao dịch xu" /
    "Coin transaction". Screen title "Lịch sử xu" / "Coin history"; empty "Chưa có giao dịch nào" /
    "No transactions yet".

## Tests

Only where logic lives, no screen snapshot tests: the response schema (parses a page, tolerates an unknown
reason), the reason → label mapping incl. the fallback, and the redeem-key reuse rule if it is extracted into
a small pure helper (preferred, so it is testable without rendering). No comments in test files.

## Out of scope

Filtering by reason, totals per period, a coin purchase flow (there is none), offline caching of the ledger.
