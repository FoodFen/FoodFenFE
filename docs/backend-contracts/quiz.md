# Quiz — API contract

Design spec: [`2026-10-03-quiz-design.md`](../superpowers/specs/2026-10-03-quiz-design.md).
This file is the wire contract to implement; a change after the client is
built against it starts here, not as a silent divergence.

## Context

Nutrition/healthy-living quizzes that pay coins. Two modes:

- **Daily quiz** — one 5-question set per client-local day, answered once,
  paid per correct answer.
- **Practice** — a 5-question set on a chosen topic, replayable at will, paid
  per correct answer up to a daily coin cap. Past the cap it stays playable
  and simply pays nothing.

Coins are already server-authoritative (`GET /quests?date=`,
`POST /coins/redeem`; see the BE repo's
`docs/superpowers/specs/2026-09-30-coins-quests-design.md`). Quiz follows the
same rule: **the client never reports a score.** It submits the chosen
options; the server grades and pays. Correct answers therefore live only on
the server and are **never** in a question payload — they appear only in the
submit response.

Requires a signed-in account (coins are per-account), like quests.

## Auth

`Authorization: Bearer <accessToken>`, standard `401` handling.

## Shapes

`Quiz`:
```json
{
  "id": "string",
  "kind": "daily" | "practice",
  "topic": "string | null",
  "date": "yyyy-MM-dd",
  "coinsPerCorrect": 0,
  "coinsRemainingToday": 0,
  "status": "available" | "completed",
  "result": "QuizResult | null",
  "questions": [
    {
      "id": "string",
      "text": "string",
      "options": [{ "id": "string", "text": "string" }]
    }
  ]
}
```

- `date` is the client-local day the quiz belongs to. For `practice` it is
  fixed at creation and decides which day's coin cap the quiz counts against.
- `coinsRemainingToday` is the practice coin cap left on `date`; `null` for
  `daily`.
- `status: "completed"` + `result` present when this quiz was already
  submitted; `questions` is still returned so the client can render the review.
- No field in `Quiz` may reveal a correct option.

`QuizResult`:
```json
{
  "quizId": "string",
  "correctCount": 0,
  "total": 5,
  "answers": [
    {
      "questionId": "string",
      "selectedOptionId": "string",
      "correctOptionId": "string",
      "correct": true,
      "explanation": "string"
    }
  ],
  "coinsEarned": 0,
  "balance": 0,
  "coinsRemainingToday": "int | null"
}
```

`coinsRemainingToday` is `null` for `daily`, same as on `Quiz`.

## `GET /quizzes/topics`

Response `200`:
```json
{ "topics": [{ "id": "string", "label": "string" }] }
```

## `GET /quizzes/daily?date=yyyy-MM-dd`

`date` is the client's local day. Lazily creates that day's quiz on first
read; later reads return the same quiz. Response `200`: `Quiz` with
`kind: "daily"`. `400` if `date` is outside roughly ±1 day of the server's UTC
today (stops a client farming coins by claiming new days).

## `POST /quizzes/practice`

Creates a **new** practice quiz instance for the account (fresh id each call).
POST, not GET, because every call writes a row.

Request:
```json
{ "topic": "string", "date": "yyyy-MM-dd" }
```

Response `200`: `Quiz` with `kind: "practice"`. `date` is stored on the quiz
and decides which day's coin cap it counts against (the cap is the sum of the
user's practice ledger rows for that date). `404` for an unknown `topic`;
`400` for a `date` outside the ±1 day window above.

## `GET /quizzes/{quizId}`

Re-reads any quiz of the account, including a completed one with its stored
`result`. This is how the client recovers after a `409` and how it shows a
practice result later. Response `200`: `Quiz`. `404` as below.

## `POST /quizzes/{quizId}/submit`

Request:
```json
{ "answers": [{ "questionId": "string", "optionId": "string" }] }
```

Response `200`: `QuizResult`. Grading and payout happen in this one call.

- Must contain exactly one answer per question; otherwise `400`.
- Each quiz is submittable **once**. A second submit is `409`
  (`quiz_already_submitted`) and pays nothing; the client then re-reads the
  quiz via `GET /quizzes/{quizId}` to show the stored result.
- Payout is one coin-ledger row per quiz, with a new `CoinReason` value
  (e.g. `quiz_daily` / `quiz_practice`) and a uniqueness guard per
  user + quiz so a retry or race can't pay twice (payout via conditional
  update, like `uq_quests_user_type_date`).
- Practice past the cap is **not** an error: it returns `200` with
  `coinsEarned: 0`.
- `404` if `quizId` doesn't exist or belongs to another account (identical,
  so existence isn't leaked).

## Errors

Standard error body, same mapping as every other endpoint: `400` malformed or
incomplete answers or a `date` outside the ±1 day window, `401` per Auth,
`404` as above, `409` already submitted.

## Left to the backend session's judgment

- Question bank storage and authoring (admin-created quizzes are expected
  later; the client doesn't care where questions come from).
- Content language: no content i18n convention exists yet; if language
  matters, accept a `language=vi|en` query param like `/ai/food/analyze-*`.
- Actual values of `coinsPerCorrect`, the practice cap, and the daily/practice
  difference. The client reads them from the payload and hard-codes none.
- Question selection (random vs curated per day) and avoiding repeats.
