# Quiz + coin rewards — design

Status: design approved by user; pending written-spec review.

## Context

Goal: reinforce users' nutrition and healthy-living knowledge, with light
personalization (RAG / AI with access to the user's data) as a later
extension. "Points" are the existing coins — no separate XP/level.

Coins and quests are server-authoritative: the client never reports progress
or completion. Quiz follows that rule, so the server holds the questions,
grades the answers and pays through the coin ledger. Nothing quiz-related
exists on the backend yet; the wire contract is
[`quiz.md`](../../backend-contracts/quiz.md) and the backend must be built
first.

## Scope

In:

- **Daily quiz** — 5 questions per client-local day, one attempt, coins per
  correct answer.
- **Practice** — pick a topic, 5 questions, replayable; coins per correct
  answer with a daily coin cap (still playable, pays nothing past the cap).
- Entry points: a Dashboard card ("today's quiz" with done/not-done) and an
  entry in the Achievements tab, both opening the same quiz flow.

Out (not built, no stubs):

- Admin-authored quizzes (server-side concern, no FE change).
- AI/RAG-personalized questions (a future server-side change to how
  questions are produced; the FE contract doesn't change).
- A quest line pointing at the quiz, XP/levels, streak or quest effects.
- Offline quizzes, local question bank, new SQLite tables, tests.

## Architecture

Approach A: standalone quiz endpoints beside quests, not a quest type.

```
src/api/endpoints/quiz.ts      — topics, daily, startPractice (POST), byId, submit (+ zod in schemas.ts)
src/features/quiz/queries.ts   — TanStack Query: useDailyQuiz, useQuiz(id), useQuizTopics;
                                 mutations useStartPractice, useSubmitQuiz
src/features/quiz/store.ts     — Zustand: selected answers + current index
app/quiz/                      — index (hub: daily + practice entry), practice (topic picker),
                                 [id] (take the quiz; shows the stored result once completed)
```

- Quiz data is server data, transient: TanStack Query only, no SQLite.
- The only local persistence touched is the coin balance cache, updated from
  the submit response (`balance`) the same way quests/redeem already do.
- Answers in progress are ephemeral UI state (Zustand), never in a query.

## Flow

1. User taps the Dashboard card or the Achievements entry. Today's state is
   read from cache.
2. Not yet done: `app/quiz/` steps through 5 questions; choosing an answer
   only writes to the store.
3. After the last question, one `submit`. The result screen shows
   correct/incorrect per question, the explanation, and coins earned; the
   coin balance cache updates.
4. Already done: the card shows "completed" and opens the stored result.
   Practice stays available and shows the remaining coin cap.

## Non-blocking rules

- Quiz needs the network (the server grades) but it is a user-initiated
  action, not background sync, so it may wait visibly on `submit`.
- "Already done today", "no connection" and "cap reached" are decided from
  cached state: stop locally rather than send a request to be refused. Cap
  reached does not block practice, only the reward display.
- The Dashboard card must render from cache and never block the dashboard on
  a quiz fetch.

## Errors

- Network failure mid-quiz: keep the answers in the store, allow retry.
- `409 quiz_already_submitted`: re-read the quiz via `GET /quizzes/{id}` and
  show the stored result instead of a generic error.
- Other failures: existing `ApiError` handling.
- Reward amounts and the cap come from the payload; nothing is hard-coded.

## Open items for the implementer

- Exact visual design of the card, the question screen and the result screen.
- Whether the topic picker is its own screen or a sheet.
- UI copy and i18n (no content i18n convention exists; follows whatever the
  app already does for static strings).
