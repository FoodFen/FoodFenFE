# AI chat — design

Status: approved by user, ready for implementation planning.

## Context

FoodFend has no chat feature today (confirmed by search — no `chat`,
`message`, or `conversation` concept exists anywhere in `src/` or
`src/db/schema.ts`). This adds one: a single ongoing conversation per user
with a server-hosted AI assistant. The server side (the assistant itself,
message persistence, the streaming endpoint) **does not exist yet** and will
be built in a separate session. This document is split in two for that
reason: a design for the client work this session owns, and a self-contained
**API contract** (below) written so the future backend session can implement
against it without re-deriving these decisions.

This is a deliberate departure from this app's local-first design
(`src/data/sync.ts`): every other feature keeps the device database
authoritative and the server as an accelerator. Chat has no offline
identity — a message exchange with an AI assistant that isn't reachable
isn't "pending," it just didn't happen — so it is the first feature in this
codebase that is purely server-backed, gated the same way optional account
features already are, with no local fallback and no SQLite table.

## Scope

**In scope:**
- One continuous conversation per user (no thread list, no multiple
  conversations) — history scrolls back through everything said so far.
- Sending a message and receiving a token-by-token streamed reply.
- Loading past history (cursor-paginated) when the chat screen opens.
- Gating identical to every other account feature: no backend configured, no
  signed-in session, or offline all show the same "unavailable" affordance —
  reusing `canUseRemote()` from `src/data/sync.ts` as-is (it already checks
  exactly the three conditions chat needs: `env.hasBackend`, an active
  session, and connectivity — no new gating concept required).
- General nutrition-advice conversation only. The client sends nothing about
  the user's own logged diary/activity/goals data — just the message text.
  This is a deliberate v1 boundary, not an oversight (see below).

**Explicitly not in scope for this pass:**
- Multiple named conversations / a history list UI. Revisit only if a real
  need for parallel conversations shows up.
- Any diary/activity/goal data as context ("how many calories have I eaten
  today"). Adding this later means defining a context-payload contract and
  deciding how much history to summarize into it — real design work,
  deliberately deferred rather than half-built now.
- Local/offline caching of chat history. There is no `chat_message` table in
  `src/db/schema.ts` and none is added by this design. Offline shows the same
  "unavailable" state as any other account feature with no connection.
- Push/background delivery of assistant messages outside an open client
  request. The assistant only ever replies to a request the client just made.
- Rate limiting, abuse prevention, and moderation policy are server
  concerns, called out in the contract below as the backend session's to
  design — the client only needs to know it may see `rate_limited` like any
  other endpoint.

## Client architecture

```
src/api/
  schemas.ts              — + chatMessageSchema, chatRoleSchema
  endpoints/chat.ts        — getHistory() (plain request), streamReply() (hand-rolled streaming)
src/features/chat/
  queries.ts               — useChatHistory() (TanStack useInfiniteQuery)
  store.ts                 — useChatStore (Zustand: in-flight streaming bubble + status)
app/
  chat.tsx                 — modal route, pushed from a dashboard header button
```

### Why a hand-rolled streaming function instead of the generic `request()`

`src/api/client.ts`'s `request()` buffers a full JSON body and returns one
parsed value — it has no concept of a response that arrives in pieces. Real
`EventSource` doesn't apply either: it's GET-only, and sending a chat message
needs a POST body. Instead, `streamReply()` uses `expo/fetch`, whose
`Response.body` is a genuine readable stream backed by native networking —
unlike React Native's built-in `fetch`, which still buffers the whole
response before resolving. This needs no new dependency: as of Expo SDK 56,
`expo/fetch` *replaces* the global `fetch` on Android and iOS, and this
project is on SDK 57 — so the global `fetch` already streams and no explicit
`expo/fetch` import is strictly required, though `streamReply()` should
import it explicitly anyway for clarity at the one call site that actually
depends on streaming behavior. Known sharp edge to watch for during
implementation: some Expo SDK releases have had bugs specifically around
consuming a stream of discrete JSON objects (the response data is still
fully delivered even when it surfaces as a console error) — worth a quick
check against the installed SDK version before assuming a clean signal.

`streamReply()` reads the body in chunks, splits on blank lines, and parses
each `event:`/`data:` frame per the contract below, calling one of three
caller-supplied callbacks (`onToken`, `onDone`, `onError`) as frames arrive.
It authenticates and handles 401-refresh-and-replay the same way `request()`
does today (same `AuthHandlers`, same Bearer header) — that logic is
duplicated rather than shared with `request()`, since `request()`'s control
flow is built around "await one response, parse one body" and forcing a
streaming case through it would compromise both.

### Chat UI: `@kesha-antonov/react-native-chat`

A maintained, TypeScript-first, Expo-ready fork of `react-native-gifted-chat`
with first-class support for this exact case: its `useStreamingMessages` hook
batches token pushes with `requestAnimationFrame` so a fast stream renders at
most once per frame, and it renders markdown in assistant replies. Its peer
dependencies (`react-native-reanimated`, `react-native-gesture-handler`,
`react-native-safe-area-context`, `react-native-keyboard-controller`) are all
already installed in this project, so adopting it adds no new native module.
Its own reactions/swipe-reply/quick-reply features are simply unused — this
feature doesn't need them.

### Data flow

1. `app/chat.tsx` mounts → `useChatHistory()` loads past turns via
   `GET /chat/messages` (cursor pagination).
2. User sends a message → appended to the message list optimistically →
   `chatApi.streamReply({ message })` opens the streaming POST.
3. `token` frames feed `useStreamingMessages`; the bubble grows as they
   arrive.
4. A `done` frame carries the finalized, server-persisted message (with its
   real id and timestamp) — the streaming bubble is replaced with it, and
   `queryKeys.chat.history` is invalidated so a later screen-open reads the
   canonical row rather than the client's locally-accumulated text.
5. An `error` frame (or a network/HTTP failure) surfaces inline on the
   pending message with a retry affordance — the same `ApiError.userMessage`
   convention used everywhere else in the app.

### Availability gating

`app/chat.tsx` checks `canUseRemote()` on mount (same three-condition check
already used by every local-first read's remote half) before rendering the
chat UI at all. When false, it shows the same "accounts unavailable" framing
already used elsewhere (`ApiError('not_configured').userMessage`), plus,
when the reason is specifically "no session," a path to sign in.

### i18n

New keys under a `chat` namespace in `src/lib/i18n/{en,vi}.ts`: screen title,
input placeholder, unavailable-state copy, retry button, error message.

## API contract (for the backend session)

This section is the complete interface the client is built against. The
backend session should treat it as the spec to implement — not a suggestion
to redesign — since the client code (this session's output) will already
depend on these exact shapes. If a change is needed, it should come back to
a client-side update, not a silent divergence.

### Auth

Identical to every other authenticated endpoint in this app: `Authorization:
Bearer <accessToken>`, standard 401 on an expired/invalid token (the client
already retries once after a token refresh — no special-case needed).

### `GET /chat/messages`

Cursor-paginated history, newest-first page semantics (client reverses for
display).

Query params:
- `before?: string` — an opaque cursor (recommend the previous page's oldest
  message id or a timestamp string); omitted for the first page.
- `limit?: number` — page size; server may cap/default this.

Response `200`:
```json
{
  "messages": [
    {
      "id": "string",
      "role": "user" | "assistant",
      "content": "string",
      "createdAt": "ISO 8601 string"
    }
  ],
  "nextCursor": "string | null"
}
```

### `POST /chat/messages`

Sends one user message and streams the assistant's reply.

Request body:
```json
{ "message": "string" }
```

No other fields — v1 sends no diary/profile/context data, per the scope
above.

Response: `200`, `Content-Type: text/event-stream`, body is a sequence of
frames in the standard SSE wire format (`event: <name>\ndata: <json>\n\n`):

- `event: token` — one incremental text delta.
  ```json
  { "delta": "string" }
  ```
- `event: done` — exactly once, last frame of a successful stream. Carries
  the full persisted assistant message so the client can reconcile against
  its accumulated text (they should match, but the server's copy is
  canonical — e.g. if any server-side post-processing altered the final
  text).
  ```json
  { "message": { "id": "string", "role": "assistant", "content": "string", "createdAt": "ISO 8601 string" } }
  ```
- `event: error` — sent instead of `done` if generation fails after
  streaming has already started (so a plain HTTP error status is no longer
  possible). Carries a user-safe message.
  ```json
  { "message": "string" }
  ```

If the request fails before any streaming begins (auth failure, rate limit,
validation, server error), respond with a normal non-200 status and the same
error body shape every other endpoint in this API already uses (`message`
and/or `errors`, per `src/api/errors.ts`'s `parseErrorBody`) rather than a
stream — the client's existing `ApiErrorKind` handling (`unauthorized`,
`rate_limited`, `validation`, `server`, etc.) covers this without any
chat-specific branching.

### Left to the backend session's own judgment

- The assistant's system prompt / persona / model choice.
- Rate limiting and abuse prevention — the client only needs a `429` to
  produce `rate_limited`, already handled generically.
- Message persistence/storage design, moderation, and retention policy.
- Cursor format for `before` — any opaque string works; the client never
  parses it, only round-trips it.

## Testing

- `chatApi.streamReply()`'s frame parser (splitting `text/event-stream` into
  `token`/`done`/`error` events) is the one piece of genuinely new, non-trivial
  logic on the client and gets a unit test against a fake chunked stream —
  same bar CLAUDE.md sets for a parser/branch, independent of the network
  layer.
- `useChatHistory()` and the chat screen follow the same "not independently
  unit-tested, exercised as the rest of this app's TanStack Query hooks and
  screens already are" convention as every other dashboard query hook.
- No local repository/database layer exists here to test — this is this
  feature's one deliberate architectural difference from the rest of the app.
