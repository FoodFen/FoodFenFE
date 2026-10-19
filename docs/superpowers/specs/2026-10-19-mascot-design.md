# Mascot — design

Status: decisions agreed with the user in brainstorming (2026-10-19); pending written-spec review.

## Intent

The mascot exists to **get the user to log**. It sits on the dashboard, looks
hungry when a usual meal time has passed without a log and thirsty when water
falls behind pace, and nudges with a short speech bubble that opens the right
log flow. It also reacts to what the user just logged (eats, drinks, works
out), so logging feels acknowledged. Users can buy other mascots with coins;
the equipped one also replaces the AI chat avatar.

Success: a user who hasn't logged lunch by their usual time opens the app,
sees a hungry mascot asking about lunch, taps the bubble, and is in the food
log in one step.

### Non-goals

- Final artwork. The user supplies assets later; v1 ships placeholder art.
- Push notifications from the mascot (meal reminders already exist).
- Mascot reacting to quests, streaks or coins.
- A mascot in onboarding, or choosing one there.
- Premium-only mascots.

### Anti-goals

- The bubble must never sit over UI permanently — it animates in, holds,
  animates out.
- No network call ever gates the mascot showing up or changing (CLAUDE.md
  "No server-related sync may block the UI").
- No extra rings or visual clutter on the summary card.

## Part 1 — Dashboard mascot

### Placement (`SummaryCard`)

- The mascot sits on the left of `SummaryCard`, **inside** the existing
  calories-left `ProgressRing` (the ring still fills and turns red when over).
- The calories-left number leaves the ring centre and becomes a fourth
  `StatRow` on the right ("Left" / "Over", same `kcalRemaining` value and
  danger tone). No second ring anywhere.
- The bubble is a strip **inside the card, below the mascot row and above
  the macro bars** (mockup option C). It animates open (height + fade, spring),
  holds ~5 s, then animates closed so the card returns to its normal height.
  Reduced motion: no height animation, plain fade.
- Tapping a reminder bubble opens the matching log via `useLogSheetStore.present`
  (food for hungry, water for thirsty). Tapping a reaction bubble just closes it.

### States

Mascot "actions" (one image each — see Assets):

| Action | When |
|---|---|
| `idle` | default |
| `hungry` | a usual meal time today has passed and that meal has no entry today |
| `thirsty` | today's water is behind pace (below) |
| `eating` | reaction: any food log (photo, voice, typed, manual, search, dishes) |
| `drinking` | reaction: any water log |
| `exercising` | reaction: any activity log |
| `thinking` | chat: assistant reply streaming |
| `happy` | chat: reply finished (one-shot) |
| `confused` | chat: send failed |

Priority on the dashboard: a pending reaction > `hungry` > `thirsty` > `idle`.
The mascot reflects **today** regardless of the day selected in `WeekStrip`;
bubbles only show while today is selected.

**Hungry rule.** For breakfast, lunch, dinner: meal time = the meal reminder's
own `time` ?? `notificationRepository.medianMealTime` ?? `DEFAULT_MEAL_TIMES`
— exactly the resolution `reconcileMeal` in
`src/features/notifications/reconcile.ts` already uses; reuse it, don't
re-derive. Hungry if now is past a meal time and today has no entry with that
`mealType`. The bubble names the latest missed meal. Applies even when that
meal's notification is disabled.

**Thirsty rule ("behind pace").** Expected fraction = clamp((now − wake) /
(sleep − wake), 0, 1). Thirsty if `waterMl / targetWaterMl < expected − lag`.
Outside the wake–sleep window: never thirsty. Defaults: wake 08:00, sleep
22:00, lag 25 percentage points. Pure function in `src/lib/` with one test.

**Reactions.** Every log flow already exits through `usePostLogInterstitial`
(`src/features/gamification/queries.ts`) — that is the one place to queue a
reaction. It needs to know what was logged (food / water / activity); give it
that, don't add per-screen triggers. The reaction plays when the dashboard is
next visible (immediately for the dashboard's own water cups), with a short
bubble ("Delicious!"). It plays once, then the mascot falls back to its
state. Reactions are local and fire whether or not the user is signed in.

**Bubble frequency.** A reminder bubble shows at most once per dashboard
focus — not on every re-render or refetch.

### User settings

A "Mascot" section in `app/settings/index.tsx`, values in `useSettingsStore`
(MMKV, like the other preferences):

- Mascot reminders on/off (hungry/thirsty looks + bubbles). Reactions stay on.
- Wake time and sleep time (the water-pace window).
- Allowed lag (%).

Meal times are not duplicated here; they are the existing meal reminder times.

## Part 2 — Owning and equipping mascots

- Every account owns one free default mascot; 2–3 others are bought with
  coins. Guests (no session or no backend) only ever see the default.
- **Catalogue and prices are server-owned** (same shape as `coins/bundles`):
  the server lists ids, names and costs; artwork ships in the app keyed by
  id. A server id the app has no art for is hidden.
- **Purchase is server-authoritative**, same as `coins/redeem`: the client
  checks the cached balance first and stops locally if it's short (CLAUDE.md
  "Never block the UI for small things"), otherwise calls the server, then
  `reconcileCoinBalance` with the returned balance.
- **Equipped mascot is stored on the server** so it follows the account.
  Equipping is local-first: switch immediately on device, send to server
  fire-and-forget; the next pull reconciles. On sign-out, fall back to the
  default (it's account state, like `clearAccountState` drops coins).
- Shop UI: a "Mascots" section in `app/shop.tsx` beside the Premium bundles —
  card per mascot with preview, cost, and Buy / Equip / Equipped. Skeletons
  while loading, pull-to-refresh, per CLAUDE.md.

### Backend contract (FoodFenBE — not built yet)

Builder of the BE side decides storage; the wire shape the FE needs:

- `GET /mascots` → `{ balance, equippedId, mascots: [{ id, name, coinCost, owned }] }`.
  The default mascot has `coinCost: 0`, `owned: true` for everyone.
- `POST /mascots/{id}/purchase` → same body as `GET /mascots`. 409 insufficient
  coins, 409 already owned, 404 unknown id. Writes a `spend` ledger line.
- `PUT /mascots/equipped { mascotId }` → `{ equippedId }`. 409 not owned.

Per CLAUDE.md the FE session must not write to `../FoodFenBE`; this goes to
that repo's session (or the user).

## Part 3 — Chat mascot

`AiAvatar` (`src/components/chat/AiAvatar.tsx`) renders the equipped mascot
instead of the brand avatar, in all three places it's used (header, empty
state, message avatar):

- `thinking` while streaming (replaces the current `pulsing` ring),
- `happy` once when a reply finishes,
- `confused` when a send fails,
- `idle` otherwise (including the empty state).

## Assets

- **User's direction (tentative, "try it and see"):** one **static image per
  action**. On every action change the mascot plays one transition — a spin
  or a single bounce — and swaps the image. No looping per-action animation.
- Rendered with `expo-image` (installed) and Reanimated for the transition.
  No new dependency.
- v1 placeholder: until the real images arrive, each action is a simple
  drawn variant (react-native-svg, installed), distinct enough to tell apart.
- Each mascot maps action → image in one registry keyed by mascot id, so the
  real files drop in without touching state logic.

## Separate small change — quest toast

Replace the even/odd toast rule with "toast only on completion": delete
`shouldAnnounce`, `bumpQuestAdvance` and `questAdvanceCounts`, and push a
toast entry only for quests that just completed. The first-seen-type
interstitial is unchanged. Independent of the mascot work; can ship first.

## Calls made after the spec review (Claude's, not the user's — check these)

- **Local storage.** No SQLite table. The catalogue + owned flags are a
  TanStack Query (`GET /mascots`) persisted by the existing query persister;
  the equipped id is cached in MMKV, plus a `pendingEquipId` set on equip and
  cleared on server ack, retried on the next mascot pull — so an offline
  equip isn't lost. Both cleared on sign-out.
- **Pull timing.** A background `GET /mascots` query mounted in the tabs
  layout (same pattern as `useQuestsPull`), re-fetched on shop open. Balance
  from it goes through `reconcileCoinBalance`.
- **Reactions.** Queued at the top of `usePostLogInterstitial`'s returned
  function, *before* the signed-in/remote guard, so guests get them. The
  hook takes the kind (`'food' | 'water' | 'activity'`) from each call site;
  `LogSheet` passes whichever panel logged. Deletes and edits don't react;
  `WaterSection` only on increases (as today). Last-wins, 2-minute TTL; if
  another day is selected, it waits until today is shown (within the TTL).
- **Hungry, which meal.** Only the most recent meal slot whose time has
  passed counts — once dinner time passes, a missed breakfast no longer
  makes the mascot hungry. Snacks and other `mealType`s don't count. The
  time resolution (`reminder.time ?? medianMealTime ?? DEFAULT_MEAL_TIMES`)
  is extracted from `reconcileMeal` into a shared helper both use.
- **Other day selected.** Mascot shows `idle`, no bubble. Ring size stays
  112; the "calories left" accessibility label moves to the new `StatRow`.
- **Settings UI.** Reuse the time picker the meal reminders use; lag is a
  stepper (5-point steps, 10–50%); sleep must be after wake.
- **Chat.** One shared chat-status value all `AiAvatar` instances read. The
  header avatar plays `thinking` / `happy` / `confused`; message avatars and
  the empty state stay `idle`. The empty state keeps its glow; the `pulsing`
  ring is removed.
- **Placeholder roster.** Same placeholder shape in a different colour per
  mascot id. Ids `default`, `sprout`, `berry`, `chili` — the BE seeds the
  same ids; names and prices are the BE seed's call.
- **Order.** Quest toast change → Part 1 → Part 3 (no BE needed) → Part 2
  once the BE endpoints exist. Until then the shop's Mascots section is not
  shown.

## Left to the builder

- Exact animation curves, bubble copy (en + vi), bubble hold time within
  ~4–6 s.
- Component/file names, following repo patterns.
- How the pending reaction is held between the log flow and the dashboard
  (a small Zustand store is the expected shape).
