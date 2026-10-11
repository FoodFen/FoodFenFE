# Dishes & restaurants — API contract

Source of truth: FoodFenBE `docs/marketplace.md` ("Dish tab (diner view)" and
"API → Diner"). This file is the wire contract the app is built against; a
change starts there and here, not as a silent divergence.

## Context

The diner side of the restaurant marketplace: approved dishes from approved
restaurants, ordered by what still fits the user's day. Free for every
signed-in user (no Premium gate).

Logging a dish has **no endpoint**. The app copies the dish's nutrition into a
local food entry (`dishToManualEntry`) and the existing push sync uploads it.

## Auth

`Authorization: Bearer <accessToken>`, standard `401` handling.

## Shapes

`Dish`:
```json
{
  "id": "string",
  "name": "string",
  "description": "string | null",
  "imageUrl": "string | null",
  "price": 0,
  "servingG": 0,
  "kcal": 0,
  "proteinG": 0,
  "carbsG": 0,
  "fatG": 0,
  "fiberG": "number | null",
  "dietTag": "none | vegetarian | vegan"
}
```

- `price` is an integer in VND. Nutrition is per serving; field names match
  `food_entry` on purpose so logging is a straight copy.
- `imageUrl` is always one of our own Cloudinary delivery URLs.
- `dietTag` is declared by the owner and checked by the admin. Present
  everywhere a `Dish` appears (also in chat cards, see `ai-chat.md`).

`ListedDish` = `Dish` plus:
```json
{
  "fits": true,
  "reasons": ["string"],
  "restaurant": {
    "id": "string",
    "name": "string",
    "address": "string",
    "latitude": 0,
    "longitude": 0
  }
}
```

- `fits` = **suggested by the server**, not strictly `kcal ≤ remainingKcal`
  (see "Ranking" below).
- `reasons` explain a suggestion, in this order. Codes today:
  - `fills_protein` — e.g. "Hợp phần đạm còn thiếu".
  - `exceeds_kcal`, `exceeds_carbs`, `exceeds_fat` — the dish has more than
    what is left of it. Combine them into one note, e.g. "Có thể vượt chỉ
    tiêu kcal, tinh bột".
  - The client **ignores unknown codes**; more may be added.
  - `[]` on non-suggested dishes and when the user has no goal.

## `GET /dishes`

All query params optional and combinable:

| Param | Meaning |
|---|---|
| `date` | `yyyy-MM-dd`, the client's local day. Omitted → the Vietnam (UTC+7) day. |
| `q` | ≤ 100 chars. Matches dish name **or** restaurant name, case- and Vietnamese-diacritic-insensitive (`đ`→`d`; "pho" finds "Phở"). Blank = no filter. |
| `fits` | `true` = only suggested dishes, `false` = only non-suggested. Omit for both. The app only ever sends `true`. |
| `kcalMin`, `kcalMax`, `proteinMin` | Numbers ≥ 0, inclusive. |
| `priceMin`, `priceMax` | Integer VND ≥ 0, inclusive. |
| `limit` | 1..50, default 20. |
| `cursor` | Opaque; pass back the previous page's `nextCursor`. |

Response `200`:
```json
{
  "remainingKcal": "int | null",
  "dishes": ["ListedDish"],
  "nextCursor": "string | null"
}
```

- `remainingKcal` = the goal in force on `date` minus that day's logged kcal.
  `null` when no goal is in force. Filters never change it.
- Order: rank first, then filter, then page. The client must not re-sort.

### Ranking

The server ranks by how well a dish's macro split matches what is left of
the day (kcal, protein, carbs, fat), not by kcal alone. Server-side detail
lives in FoodFenBE's dish-recommendation spec; what the client can rely on:

- Suggested (`fits: true`) dishes come first: those within `remainingKcal`,
  then those up to ~10% over it.
- If fewer than 3 dishes are suggested, the server tops up to 3 with the
  lowest-kcal remaining dishes (also when `remainingKcal` is 0). Those carry
  `exceeds_*` reasons.
- Then the non-suggested rest, lowest kcal first.
- A vegetarian/vegan user is never suggested a dish that doesn't match their
  diet; such dishes sink to the bottom of the unfiltered list.
- No goal in force: newest first, nothing suggested, no reasons.
- `nextCursor: null` = last page. Changing any filter restarts from no cursor.
- The cursor is an offset today, so a diary change mid-scroll can shift rows:
  the client dedupes by `id` when joining pages.

## `GET /restaurants/{id}`

Response `200`, the public profile:
```json
{
  "id": "string",
  "name": "string",
  "description": "string | null",
  "address": "string",
  "phone": "string",
  "openingHours": "string",
  "latitude": 0,
  "longitude": 0,
  "imageUrl": "string | null",
  "dishes": ["Dish"]
}
```

- `dishes` are the restaurant's approved dishes, oldest first, without `fits`,
  `reasons` or `restaurant`.
- `phone` and `openingHours` are required on the server (non-empty strings).
  The client schema still accepts `null` and shows a "not available"
  placeholder, so a future relaxation can't crash the screen.
- `404` when the restaurant doesn't exist or isn't approved.

## Errors

Standard error body. `401` per Auth. Bad query values (e.g. `limit=0`, a
malformed `cursor`, a negative bound) → `422`:
```json
{ "message": "validation failed", "errors": { "query.limit": "string" } }
```
