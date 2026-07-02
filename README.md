# Travel Planner

A laptop-first, mobile-friendly web app for two people to visually plan a
multi-week trip on a board where **each column is a day**. Days are color-coded
by city, host activity cards on a continuous, time-proportional timeline, and
show accommodation as horizontal bars spanning the nights they cover.

- Each day column is a time-scaled timeline over a configurable window (default
  06:00–21:00, set per trip in the Trip modal opened from the header `[✎ Trip]`
  button); timed cards are sized by their
  duration so free time stays visible. A card's height can also be a preset
  (small / half-day / whole-day) instead of its exact duration. A long
  (multi-week) trip scrolls horizontally on desktop: a right-edge fade signals
  more days off-screen, a **Jump to today** button scrolls today's column into
  view, and a date-range stepper (`‹ dd.mm – dd.mm ›`) pages the scroll a screen
  at a time.
- Any card can be given a **category** (indoor / outdoor / transit), shown as a
  colour chip (a legacy transport flag renders as the transit category). Weekend
  columns mark the weekday label in vermilion rather than tinting the column.
- Dragging a card shows an overlay that follows the cursor across days and
  highlights the day it will land in. Dragging an **untimed** card toward the
  evening of a day with timed cards gives it a start time inferred from its
  drop position (snapped to 15 min). The narrow/mobile view shows as many day
  columns as fit the viewport and pages by that count, with city-coloured pager
  dots to jump between pages and a scroll hint when a day's timeline overflows;
  editors open as full-screen sheets and the header controls collapse into a
  `≡` menu (Trip / Cities / Add stay).
- A day's city is resolved automatically (a covering stay, else none), but each
  day header has a city control to **pin a city manually** ("Auto" clears it).
  Cities are added, renamed, recolored, and removed in the **Cities** modal
  (header `[◉ Cities]` button); each new city is auto-assigned a distinct color
  from a built-in palette (preferring an unused one), still overridable in the
  color picker.
- The stays lane is always shown: each uncovered gap's first day carries an
  **Add stay** button (and one sits at the right end of the lane). Two stays
  that share only a changeover day meet mid-day on one row; genuine
  double-bookings still stack on separate rows.
- Dates and times **display** in European format (`dd.mm`, 24-hour). Stored
  values stay ISO. Date and time entry uses the app's **own pickers** — a calendar
  pop-over (single date for the trip start; a first→last night **range** for a
  stay) and an hour/minute wheel — anchored below their field on desktop and
  presented as full-screen sheets on mobile; there are no native `<input>`
  widgets, so the European display is consistent everywhere (see
  [`docs/trip-schema.md`](./docs/trip-schema.md) storage note).

Edits persist instantly to local storage (IndexedDB) and sync in the background
via Liveblocks + Yjs (CRDT), so two people can co-edit the same board in real
time. Access is via a **secret link** (the room id lives in the URL hash) with no
login; a small Cloudflare Worker holds the Liveblocks secret key, mints access
tokens, and restricts new-room creation to the owner. The same Worker exposes a
structured HTTP API so an **AI agent can read the whole trip and write it back**
— you discuss the plan with the agent and it visualizes it directly in the room.

## Architecture

Two independent pieces deployed on Cloudflare:

1. **The SPA** — a static Vite + React + TypeScript build (`dist/`), served by
   **Cloudflare Pages**. Local-first: it renders and edits on IndexedDB alone, so
   it is fully usable offline with no backend.
2. **The Worker** (`worker/`) — mints Liveblocks tokens, gates room creation, and
   exposes the agent HTTP + MCP API. It holds the only copies of
   `LIVEBLOCKS_SECRET_KEY`, `OWNER_SECRET`, and `MCP_API_KEY`; none ever reaches
   the browser.

```
Browser (Pages)  ──auth / rooms / trip──▶  Worker  ──REST + secret key──▶  Liveblocks
        │                                                                       ▲
        └──────────────── Yjs sync (token-scoped, via Liveblocks) ─────────────┘
```

The browser only ever talks to the Worker (for auth, room creation, and the
agent API). Liveblocks talks to the Worker too, via the secret key.

### The secret link (room id)

The room id lives in the URL **hash** — `https://<app>/#room=<roomId>` (a bare
`#<roomId>` is also accepted). That hash is the "secret link":

- **Anyone with the link can join and co-edit** an existing room with no login.
  The client posts the room id to the Worker's `/api/auth`, which mints a
  room-scoped token *only if the room already exists*.
- **Creating a new room requires the owner secret** (`POST /api/rooms`, gated by
  `x-owner-secret`). This is the only way rooms come into existence, which
  satisfies "nobody but me can create rooms" while keeping a guest's access
  login-free.

### Shared data modules

The zod schema, the Y.Doc shape, the typed doc mutators, and the
"trip JSON → doc" apply logic live in environment-agnostic modules under
`src/data/` and are imported by **both** the client and the Worker, so the agent
API and the UI never drift. See [`CLAUDE.md`](./CLAUDE.md) for the data-model
conventions.

## Tech stack

- **Client:** Vite + React + TypeScript, Tailwind CSS (the "ink & type" design
  tokens — Lora/Manrope fonts, city hues, radii — live in `tailwind.config.js`;
  fonts are self-hosted via `@fontsource` so the local-first app renders
  offline), `@dnd-kit` (drag/drop), Yjs + `@liveblocks/client`/`@liveblocks/yjs`
  (sync), `y-indexeddb` (local persistence), `zod` (schema), `date-fns` (date
  math).
- **Worker:** a single Cloudflare Worker using Liveblocks REST + the secret key,
  configured and deployed with Wrangler. `zod-to-json-schema` publishes the trip
  JSON Schema at `GET /api/schema`.
- **Tests:** Vitest + React Testing Library + jsdom for pure logic; Playwright
  for end-to-end UI flows.

## Getting started

Requires Node 18+ and npm.

```sh
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

The app runs **local-first**: without a Worker URL configured it still loads and
edits entirely on local IndexedDB (no sync). To enable background sync and room
creation, run the Worker locally and point the client at it (below).

### Environment variables

The only client variable is the Worker base URL. Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_WORKER_URL` | client (`.env`) | Base URL of the Worker. Default `http://localhost:8787`. `VITE_`-prefixed, so it is baked into the bundle at build time — only ever a public URL, never a secret. |
| `LIVEBLOCKS_SECRET_KEY` | Worker secret | Liveblocks project secret key (`sk_...`). Never shipped to the client. |
| `OWNER_SECRET` | Worker secret | Gates `POST /api/rooms` and the owner agent API. Any long random string. |
| `MCP_API_KEY` | Worker secret | Gates the MCP endpoint (`POST /mcp`), presented as `Authorization: Bearer <key>`. Any long random string. |
| `ALLOWED_ORIGIN` | Worker var (optional) | Pin CORS to your Pages origin in production; reflects the request Origin when unset. |

For local Worker dev, copy `worker/.dev.vars.example` to `worker/.dev.vars`
(gitignored) and fill in real values.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc --noEmit && vite build` → `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Vitest unit/integration suite (single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm run coverage` | Vitest with coverage |
| `npm run worker:dev` | `wrangler dev` for the Worker (http://localhost:8787) |
| `npm run deploy:worker` | Deploy the default/test Worker |
| `npm run deploy:worker:prod` | Deploy the production Worker |

## Testing

- **Vitest** covers the pure, environment-agnostic logic in `src/data/`
  (day generation, city resolution, card sort, schema validation, doc mutators,
  trip-apply) plus a two-`Y.Doc` integration test that merges updates between
  docs to verify CRDT sync — no mocked Liveblocks.
- **Playwright** drives the real UI against the dev server. Because the app is
  local-first, these flows run with no live backend.

```sh
npm test          # unit + integration
npm run test:e2e  # end-to-end
```

## Deployment

See [`docs/deployment.md`](./docs/deployment.md) for the full Cloudflare Pages +
Worker deploy flow (secrets, CORS, Pages build config, creating the first room,
and sharing the secret link).

## Agent API

The trip serializes to a single JSON document — the format the agent API reads
and writes (there is no in-app import/export). The zod schema in
`src/data/tripSchema.ts` is the single source of truth, and `GET /api/schema`
publishes the matching JSON Schema. See
[`docs/trip-schema.md`](./docs/trip-schema.md) for the schema and the agent API
(`GET`/`POST /api/trip/:room`, `GET /api/schema`, owner token, example payloads).

There are three ways to drive a board with an agent:

- **Owner HTTP API** — `GET`/`POST /api/trip/:room`, gated by the owner secret
  (`x-owner-secret`). The scripting path; see `docs/trip-schema.md`.
- **MCP connector** (`POST /mcp`) — for an MCP client such as **Perplexity Pro**.
  Add the connector with the Worker's `/mcp` URL and the `MCP_API_KEY` as a bearer
  token, then paste a board's share link into the chat. It exposes three tools:
  `get_schema`, `read_board(link)`, and `write_board(link, trip)` — the link is
  passed as a string, so the room id in the URL hash travels fine. `write_board`
  snapshots the current board before replacing it, so any AI edit is revertible.
- **Trip JSON panel** — zero-setup manual loop for any AI: open the Trip modal,
  copy the current board JSON, paste it into a chat, and paste the AI's reply back
  into the panel to Apply (guarded by a replace confirm).

**Version history & restore.** Every Worker-mediated write (owner `POST` and MCP
`write_board`) records the room's prior trip JSON to Cloudflare **KV** first
(keep-all, keyed by room + timestamp). The Trip panel's "Recent versions" list
restores any earlier version — link-gated (`GET /api/versions/:room` and
`…/:room/:id`), the same room-id-as-capability model as `/api/auth`. For live
hand-editing, Cmd/Ctrl+Z (and the ↶/↷ toolbar buttons) undo/redo within the
session; agent writes and restores are kept off that keystroke stack. Provision
the `SNAPSHOTS` KV namespace and set `MCP_API_KEY` per the notes in
`worker/wrangler.toml` and `worker/.dev.vars.example`.
