# Trip JSON schema

A whole trip serializes to a single JSON object — the format the **Export**
button downloads, the **Import** UI accepts, and the agent API
(`GET`/`POST /api/trip/:room`) reads and writes. It is the *single source of
truth*: the same zod schema (`src/data/tripSchema.ts`) validates every path, so
a trip a human imports and a trip an agent posts are held to identical rules.

Importing or posting a document is a **full replace**: the doc is cleared and
rebuilt from the payload, so what you send is exactly what the board shows.

## Shape

```jsonc
{
  "trip": {
    "title": "Italy 2027",      // string (may be empty)
    "startDate": "2027-05-01",  // "YYYY-MM-DD", or "" when not set up
    "numDays": 14               // integer 0–730 — day columns, counted from startDate
  },
  "cities": [
    { "id": "rome", "name": "Rome", "color": "#ef4444" }
  ],
  "accommodations": [
    {
      "id": "stay-1",
      "label": "Hotel Roma",
      "cityId": "rome",           // optional; omit for a stay with no city
      "startNight": "2027-05-01", // first night slept, "YYYY-MM-DD"
      "endNight": "2027-05-02"    // last night slept (checkout is the next morning)
    }
  ],
  "cards": [
    {
      "id": "card-1",
      "dayKey": "2027-05-01",     // the day column this card lives in, "YYYY-MM-DD"
      "title": "Colosseum",
      "note": "book ahead",       // optional
      "link": "https://...",      // optional; must be an http(s) URL (or empty)
      "startTime": "10:00",       // optional "HH:mm" — its presence makes the card time-bound
      "endTime": "12:00",         // optional "HH:mm"
      "order": 0,                 // integer — manual position among untimed cards in the day
      "color": "#3b82f6",         // optional
      "icon": "🎟️"                 // optional
    }
  ],
  "dayOverrides": {
    "2027-05-03": "rome"          // dayKey → cityId: pin a day's city, overriding any covering stay
  }
}
```

## Field rules

| Field | Type | Notes |
| --- | --- | --- |
| `trip.title` | string | May be empty. |
| `trip.startDate` | `"YYYY-MM-DD"` or `""` | Empty only before the trip is set up. |
| `trip.numDays` | integer 0–730 | Number of day columns from `startDate` (inclusive). Bounded at 730 (~2 years) to keep the board finite; a larger count is rejected. |
| `cities[].id` | non-empty string | Referenced by `accommodations[].cityId` and `dayOverrides`. |
| `cities[].color` | non-empty string | Any CSS color, e.g. `#ef4444`. |
| `accommodations[].cityId` | string, optional | The covered days inherit this city's color. |
| `accommodations[].startNight` / `endNight` | `"YYYY-MM-DD"` | Inclusive night span; `endNight ≥ startNight`. |
| `cards[].dayKey` | `"YYYY-MM-DD"` | The day column the card belongs to. |
| `cards[].link` | `"http(s)://…"` or `""`, optional | Web link. Must be an http(s) URL (or empty); other schemes (e.g. `javascript:`, `data:`) are rejected. |
| `cards[].startTime` / `endTime` | `"HH:mm"`, optional | 24-hour; presence makes the card time-bound (auto-sorted by time). |
| `cards[].order` | integer | Manual position among untimed cards in a day. |

## Defaults

The four collections are optional on input and default to empty — a minimal
valid document is just `{ "trip": { "title": "", "startDate": "", "numDays": 0 } }`.
An export always emits all four (sorted deterministically), so every export is
itself a re-importable document.

## City resolution

A day's city (and therefore its header color) is resolved, highest precedence
first:

1. a `dayOverrides` entry for that day,
2. the city of a covering accommodation (latest check-in wins on overlaps),
3. otherwise none — a travel day with no color.

## Validation errors

Both malformed JSON and schema violations are reported with a readable,
path-prefixed message, e.g. `cards.0.dayKey: Expected a date as YYYY-MM-DD`.

## Agent HTTP API

An agent reads and writes the same room over JSON via the Cloudflare Worker. Both
endpoints are **owner-gated**: present the owner secret as the `x-owner-secret`
header (the same secret that gates new-room creation). The room id is the one
from the secret link.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/trip/:room` | — | the room's current trip as the JSON document above |
| `POST` | `/api/trip/:room` | a trip document (above) | the validated, default-filled document |

A `POST` is a **full replace**: the document is validated, applied to the room's
Yjs doc as a wipe-and-rebuild, and the diff is pushed to Liveblocks, so connected
clients converge live. Because the Worker validates *before* touching the room, a
bad payload is a clean error and never mutates the doc.

### Status codes

| Code | When |
| --- | --- |
| `200` | `GET` succeeded / `POST` applied |
| `400` | malformed JSON or schema violation (message is path-prefixed, as above) |
| `401` | missing or wrong `x-owner-secret` |
| `404` | the room does not exist (create it first via `POST /api/rooms`) |

### Examples

Read the current trip:

```sh
curl https://<worker-url>/api/trip/<roomId> \
  -H "x-owner-secret: $OWNER_SECRET"
```

Write a trip (full replace) — connected clients update live:

```sh
curl -X POST https://<worker-url>/api/trip/<roomId> \
  -H "x-owner-secret: $OWNER_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "trip": { "title": "Italy 2027", "startDate": "2027-05-01", "numDays": 3 },
    "cities": [{ "id": "rome", "name": "Rome", "color": "#ef4444" }],
    "accommodations": [
      { "id": "stay-1", "label": "Hotel Roma", "cityId": "rome",
        "startNight": "2027-05-01", "endNight": "2027-05-02" }
    ],
    "cards": [
      { "id": "card-1", "dayKey": "2027-05-01", "title": "Colosseum",
        "startTime": "10:00", "endTime": "12:00", "order": 0 }
    ],
    "dayOverrides": {}
  }'
```

The minimal valid body is just `{ "trip": { "title": "", "startDate": "", "numDays": 0 } }`
(the four collections default to empty). See
[`docs/deployment.md`](./deployment.md) for creating a room and a live smoke test.
