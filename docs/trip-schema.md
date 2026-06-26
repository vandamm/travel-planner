# Trip JSON schema

A whole trip serializes to a single JSON object — the format the agent API
(`GET`/`POST /api/trip/:room`) reads and writes. (There is no on-page
import/export UI; this format is agent-only.) It is the *single source of
truth*: the same zod schema (`src/data/tripSchema.ts`) validates every path, and
`GET /api/schema` publishes the matching JSON Schema, so a trip an agent posts is
held to exactly the rules the schema advertises.

Importing or posting a document is a **full replace**: the doc is cleared and
rebuilt from the payload, so what you send is what the board shows. (The replace
is taken against the snapshot the Worker reads; see the concurrency note under
[Agent HTTP API](#agent-http-api) — an entity a collaborator creates *during* the
write can survive it.)

## Shape

```jsonc
{
  "trip": {
    "title": "Italy 2027",      // string (may be empty)
    "startDate": "2027-05-01",  // "YYYY-MM-DD", or "" when not set up
    "numDays": 14,              // integer 0–730 — day columns, counted from startDate
    "dayStart": "06:00",        // "HH:mm" — top of each day's timeline window (default "06:00")
    "dayEnd": "21:00"           // "HH:mm" — bottom of the window (default "21:00")
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
      "icon": "🎟️",                // optional
      "transport": false          // optional — true marks a transport leg (distinct rendering)
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
| `trip.dayStart` / `dayEnd` | `"HH:mm"`, optional | The day's timeline window — cards are scaled and placed within it. Default `"06:00"` / `"21:00"` when omitted. |
| `cities[].id` | non-empty string | Referenced by `accommodations[].cityId` and `dayOverrides`. |
| `cities[].color` | non-empty string | Any CSS color, e.g. `#ef4444`. |
| `accommodations[].cityId` | string, optional | The covered days inherit this city's color. |
| `accommodations[].startNight` / `endNight` | `"YYYY-MM-DD"` | Inclusive night span; `endNight ≥ startNight`. |
| `cards[].dayKey` | `"YYYY-MM-DD"` | The day column the card belongs to. |
| `cards[].link` | `"http(s)://…"` or `""`, optional | Web link. Must be an http(s) URL (or empty); other schemes (e.g. `javascript:`, `data:`) are rejected. |
| `cards[].startTime` / `endTime` | `"HH:mm"`, optional | 24-hour; presence makes the card time-bound (auto-sorted by time). |
| `cards[].order` | integer | Manual position among untimed cards in a day. |
| `cards[].transport` | boolean, optional | `true` marks the card as a transportation leg (train/flight/etc.), rendered with a distinct style. |

## Defaults

The four collections are optional on input and default to empty, and
`trip.dayStart`/`dayEnd` default to `"06:00"`/`"21:00"` — a minimal valid
document is just `{ "trip": { "title": "", "startDate": "", "numDays": 0 } }`.
An export always emits the collections (sorted deterministically) and the
default-filled window, so every export round-trips through `POST` unchanged.

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
| `GET` | `/api/schema` | — | the JSON Schema for the trip document (derived from the zod schema) |
| `GET` | `/api/trip/:room` | — | the room's current trip as the JSON document above |
| `POST` | `/api/trip/:room` | a trip document (above) | the validated, default-filled document |

`GET /api/schema` returns the JSON Schema generated from `tripDocumentSchema` —
the *same* schema `POST` validates against, so the published shape can never
drift from what the endpoint accepts. The `GET /api/trip/:room` response also
carries a `$schema` field pointing at `/api/schema`, so an agent reading even an
empty trip learns where to fetch the full shape. (`$schema` is informational —
it is ignored if echoed back on a `POST`.)

A `POST` is a **full replace**: the document is validated, applied to the room's
Yjs doc as a wipe-and-rebuild, and the diff is pushed to Liveblocks, so connected
clients converge live. Because the Worker validates *before* touching the room, a
bad payload is a clean error and never mutates the doc.

The replace is **snapshot-relative, not atomic against live editors**: the Worker
reads the room, computes the wipe-and-rebuild, and pushes it as a Yjs diff. An
entity a collaborator creates *after* that read is invisible to the diff's delete
set (Yjs can only delete items it has observed), so it survives the merge — the
result is your payload plus anything added during the brief read-modify-write
window. The agent API is owner-gated and not meant for use mid-collaboration, so
this is accepted rather than closed (which would need a server-side
compare-and-swap Liveblocks doesn't expose).

### Status codes

| Code | When |
| --- | --- |
| `200` | `GET` succeeded / `POST` applied |
| `400` | malformed JSON or schema violation (message is path-prefixed, as above) |
| `401` | missing or wrong `x-owner-secret` |
| `404` | the room does not exist (create it first via `POST /api/rooms`) |

### Examples

Fetch the JSON Schema:

```sh
curl https://<worker-url>/api/schema \
  -H "x-owner-secret: $OWNER_SECRET"
```

Read the current trip (the response includes a `$schema` pointer):

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
