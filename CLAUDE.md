# CLAUDE.md

Conventions for working in this repo. Read this before touching the data model.

## What this app is

A local-first, collaborative day-board for planning a trip. The SPA
(Vite + React + TS, Cloudflare Pages) renders and edits on local IndexedDB and
syncs in the background via Liveblocks + Yjs. A single Cloudflare Worker
(`worker/`) holds the secrets, mints tokens, gates room creation, and exposes the
agent HTTP API. See `README.md` for the overview and `docs/` for the schema and
deployment.

## The Yjs doc is the single source of truth

Everything persistent lives on one shared `Y.Doc`. Top-level containers:

| Container | Yjs type | Holds |
| --- | --- | --- |
| `trip` | `Y.Map` | `title`, `startDate` (`YYYY-MM-DD`), `numDays` (plain values) |
| `cities` | `Y.Map<Y.Map>` | id → `{ id, name, color }` |
| `dayOverrides` | `Y.Map` | `YYYY-MM-DD` → `cityId` (manual per-day city) |
| `cards` | `Y.Map<Y.Map>` | id → `Card` fields |
| `accommodations` | `Y.Map<Y.Map>` | id → `Accommodation` fields |

Entities are stored as **nested `Y.Map`s** (not plain objects) so concurrent
edits to different fields of the same entity merge field-by-field instead of
clobbering — the point of using a CRDT. `.toJSON()` on an entity map yields
exactly the plain-JS type in `src/data/schema.ts`.

Dates are ISO **date-only** strings (`YYYY-MM-DD`); clock times are `HH:mm`
(24-hour, local to the trip — no timezone is modelled).

## Mutate only through `src/data/doc.ts`

`doc.ts` defines the doc shape and the **only** sanctioned mutators
(`addCard`, `updateCard`, `moveCard`, `reorderCards`, `addCity`,
`setDayCityOverride`, `addAccommodation`, …). Every write goes through one of
them, wrapped in a `doc.transact(...)` so it lands as one atomic update for both
local persistence and remote sync. Do **not** poke `Y.Map`s directly from
features or the Worker.

Patch semantics: in an update patch an explicit `undefined` value *clears* that
field (e.g. untiming a card); absent keys are left untouched.

## Shared between client and Worker — never duplicate

These `src/data/` modules are **environment-agnostic** and imported by *both* the
client and the Worker so the agent API and the UI can never drift. Keep them free
of browser- or Worker-only APIs:

- `schema.ts` — plain-JS domain types (`Trip`, `City`, `Day`, `Card`, `Accommodation`).
- `doc.ts` — the Y.Doc shape + typed mutators.
- `tripSchema.ts` — the **zod schema**, the single source of truth for the
  import/export JSON *and* the agent API. Validation lives here (`parseTripText`,
  `formatTripErrors`).
- `applyTrip.ts` — validated trip JSON → doc mutations (a full replace: clear,
  then re-add via the mutators). Used by the import UI and `POST /api/trip/:room`.
- `exportTrip.ts` — doc → validated JSON. Used by the export UI and
  `GET /api/trip/:room`.

`days.ts` (day generation) and `cityResolution.ts` (resolve a day's city/color)
are also pure shared logic.

When a value or rule needs to be known in two places, derive it from these
modules rather than re-stating it.

## City resolution (hybrid)

A day's city — and therefore its header color — is resolved, highest precedence
first:

1. a `dayOverrides` entry for that day,
2. the city of a covering accommodation (latest check-in wins on overlaps),
3. otherwise none — a travel day with no color.

## Card ordering

Time-bound cards (those with a `startTime`) sort by time; untimed cards keep a
manual `order` within their day. The combined ordering lives in
`src/features/cards/cardSort.ts`.

## Synced vs. per-user state

Not everything is on the doc. The **time-direction** view preference
(morning→evening top-to-bottom vs. bottom-to-top) is a *local* preference in
`localStorage`, deliberately **not** synced — each person sees their own
direction without affecting the other. It reverses the visual order of every card
in every day. See `src/features/board/timeDirection.ts`.

Rule of thumb: trip content is synced (doc); per-viewer display preferences are
local (localStorage).

## Auth / room-creation model

- The **room id lives in the URL hash** (`#room=<id>`) — the "secret link".
- `POST /api/auth` mints a room-scoped Liveblocks token **only for a room that
  already exists** → anyone with the link joins and co-edits, no login.
- `POST /api/rooms` creates a room and is gated by `OWNER_SECRET`
  (`x-owner-secret`). This is the *only* way rooms are created → "nobody but me
  can create rooms".
- The agent API (`GET`/`POST /api/trip/:room`) is **owner-gated** too — as
  privileged as room creation.
- `LIVEBLOCKS_SECRET_KEY` and `OWNER_SECRET` live **only on the Worker**. The
  client's only configured secret-adjacent value is `VITE_WORKER_URL`, a public
  URL baked into the bundle.

## Testing conventions

- TDD (red-green): write a failing test first, then implement to green.
- Prefer Playwright e2e against the real UI (the app is local-first, so e2e runs
  with no live backend) over mock-heavy unit tests.
- Reserve Vitest for pure `src/data/` logic; verify sync with a two-`Y.Doc`
  integration test (merge updates between docs), not by mocking Liveblocks.
- `src/data/devBridge.ts` exposes the live doc + mutators on `window.__planner`
  in **dev builds only** (tree-shaken from production) so Playwright can seed
  data before some data-entry UIs exist.

Commands: `npm test` (unit/integration), `npm run test:e2e`, `npm run lint`,
`npm run coverage`.
