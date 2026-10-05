# AI chat — API contract

Full design and rationale: [`2026-09-19-ai-chat-design.md`](../superpowers/specs/2026-09-19-ai-chat-design.md).

This section is the complete interface the client is built against. Treat it
as the spec to implement — not a suggestion to redesign — since the client
code already depends on these exact shapes. If a change is needed, it should
come back to a client-side update, not a silent divergence.

## Auth

Identical to every other authenticated endpoint in this API: `Authorization:
Bearer <accessToken>`, standard 401 on an expired/invalid token (the client
already retries once after a token refresh — no special-case needed).

## `GET /chat/messages`

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

## `POST /chat/messages`

Sends one user message and streams the assistant's reply.

Request body:
```json
{ "message": "string", "date": "YYYY-MM-DD" }
```

- `message` — required, at most 2000 characters.
- `date` — optional; the user's local calendar day, same convention as
  `loggedOn` on food entries and `GET /quests?date=`. The server grounds the
  reply in the user's own data (profile, goal in force, that day's meals,
  7-day totals) and uses `date` as "today". Omitted → the server falls back
  to the Vietnam (UTC+7) day; the client always sends it. Must be between
  `2000-01-01` and `9998-12-31`; malformed or out of range → `422` with the
  usual failure body.

Response: `200`, `Content-Type: text/event-stream`, body is a sequence of
frames in the standard SSE wire format (`event: <name>\ndata: <json>\n\n`,
either LF or CRLF line endings — the client accepts both):

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
and/or `errors`) rather than a stream — the client reads this real body and
surfaces it to the user; a placeholder message is not a substitute.

## Left to the backend session's own judgment

- The assistant's system prompt / persona / model choice.
- Rate limiting and abuse prevention — the client only needs a `429` to
  produce `rate_limited`, already handled generically.
- Message persistence/storage design, moderation, and retention policy.
- Cursor format for `before` — any opaque string works; the client never
  parses it, only round-trips it.
