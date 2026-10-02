# AI food capture — API contract

This section is the complete interface the client is built against. Treat it
as the spec to implement — not a suggestion to redesign — since the client
code already depends on these exact shapes. If a change is needed, it should
come back to a client-side update, not a silent divergence.

## Context

The client sends either a photo or a one-sentence description of a meal and
gets back a suggested meal name plus itemized ingredient rows. The rows are
handed to the existing meal-composer draft (the same one the manual
"add ingredient" flow already fills) for the user to review, edit and save —
the AI response is never written to the diary directly. See
`app/log/manual.tsx` (the Image tab and the inline "Smart Entry" field) and
`src/features/diary/queries.ts` (`useAnalyzeFood`) for the calling code.

## Auth

`Authorization: Bearer <accessToken>` is optional. The client always sends
`X-Device-Id` (an opaque 1–64 char string kept in the keychain), signed in or
not. A signed-out caller is identified by that header alone; 401 only when
both it and a valid Bearer are missing, or the Bearer is invalid (the client
retries once after a token refresh).

### Free trial

Successful analyses per input method per day — `image`, `text`, `voice`
(analyze-text takes `inputMethod: "text" | "voice"`, default `"text"`):
3 for a guest (no Bearer, `X-Device-Id` only), 5 for a signed-in free user;
Premium is unlimited. A day is a fixed calendar day in Asia/Ho_Chi_Minh
(UTC+7); counts reset at midnight there. Quota key is the device while signed
out; once signed in, the higher of the device and account counts for the same
day (a device that used 3 as a guest has 2 left after signing in). The client
keeps sending `X-Device-Id` after login. Only a successful, non-empty
analysis consumes a trial.

Exhausted: `403` with `{ "message", "code": "ai_trial_exhausted",
"inputMethod", "resetsAt" }` (`resetsAt` is ISO 8601 with a +07:00 offset, e.g.
`2026-10-02T00:00:00+07:00`). The client matches on `code` (kind `trial_exhausted`):
a guest gets a sign-in prompt (signing in raises the limit); a signed-in user is
sent to the Premium screen. Checkout itself still requires sign-in. `402` stays
the existing `premium_required` response.

`GET /ai/food/quota` (same identity rules; `limit` is the one that applies to
the caller — 3 for a guest, 5 signed in):
`{ "unlimited": false, "resetsAt": "...", "image": {"limit":5,"remaining":2}, "text": {...}, "voice": {...} }`
(`remaining` is what is left today); Premium is
`{ "unlimited": true, "resetsAt": null, "image": null, "text": null, "voice": null }`.
The Image and Describe panels in `app/log/manual.tsx` read it to show "free
tries left", refetch it after every analysis, and re-key it on sign-in state so
a login/logout never shows the other identity's cached limit.

Anonymous calls are limited to 30/hour per IP (429, uncoded body), counted on
every attempt including 403s.

## `POST /ai/food/analyze-image`

Request: `multipart/form-data` with two parts:
- `image` — the photo file (jpeg/png/heic).
- `language` — `"vi"` or `"en"`, the app's current UI language (see below).

## `POST /ai/food/analyze-text`

Request body:
```json
{ "description": "string", "language": "vi" | "en" }
```
One sentence describing the meal, e.g. "a bowl of beef pho with extra herbs".

### `language`

The user's current in-app language (`useSettingsStore`'s `locale`, `"vi"` by
default). `mealName` and every `ingredients[].name` should come back entirely
in that language — no mixed Vietnamese/English within one response. Added
because the model was generating mixed-language output with no signal of
which language to prefer.

## Response (both endpoints)

`200`:
```json
{
  "mealName": "string",
  "ingredients": [
    {
      "name": "string",
      "quantityG": 0,
      "kcal": 0,
      "carbsG": 0,
      "proteinG": 0,
      "fatG": 0,
      "fiberG": 0,
      "confidence": 0.0
    }
  ],
  "imageUrl": "string | null"
}
```

- `ingredients` — one row per food item detected. `quantityG` is the model's
  best-guess portion size; every macro is scaled to that portion, not to
  100g. `fiberG` is `null` when the model has no basis to estimate it (never
  `0` for "none" unless it is actually confident there's no fiber).
  `confidence` (0–1) is per-row and UI-only — the client does not persist it,
  so its exact calibration is left to the backend's judgment; it only needs
  to be low for genuine guesses and high for confident ones, so the client
  can flag uncertain rows.
- An empty `ingredients` array means "no food recognized," not an error —
  respond `200` with `mealName: ""` and `ingredients: []` rather than a 4xx.
  The client shows this as "couldn't identify anything, try again or enter
  manually."
- `imageUrl` — set only by `analyze-image`, when the server has persisted
  the uploaded photo somewhere durable (so it can be shown later on the
  saved entry). `null` if the server does not store the image, and always
  `null` from `analyze-text`. This is stored on the local `food_entry.image_url`
  column as-is; the client does not re-derive or validate it beyond the
  existing `imageUrl?: z.url().nullish()` schema check.

## Errors

Standard error body (`message` and/or `errors`), standard status mapping,
same as every other endpoint:
- `400`/`422` — malformed request (missing `description`, unreadable image).
- `401` — see Auth above.
- `429` — rate limited; the client already surfaces this generically. This
  endpoint is the single most expensive call in the app (a full vision/LLM
  pass), so rate limiting matters more here than elsewhere — left to the
  backend session's judgment on limits.
- `5xx` — model/inference failure; the client shows a generic retry message.

## Left to the backend session's own judgment

- Model choice, prompt design, and how `quantityG`/macros are estimated from
  a photo vs. a sentence.
- Image storage (if any) behind `imageUrl` — format, retention, CDN.
- Rate limiting and per-user quota, moderation of uploaded images.
- `confidence` calibration — only its relative meaning (low = uncertain) is
  a client contract.
