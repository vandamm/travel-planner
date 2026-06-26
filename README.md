# Travel Planner

A laptop-first, mobile-friendly web app for two people to visually plan a
multi-week trip on a board where **each column is a day**. Days are color-coded
by city, host activity cards on a continuous time scale (only time-bound cards
like trains/flights carry real start/end times), and show accommodation as
horizontal bars spanning the nights they cover.

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
   exposes the agent HTTP API. It holds the only copies of `LIVEBLOCKS_SECRET_KEY`
   and `OWNER_SECRET`; neither ever reaches the browser.

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

- **Client:** Vite + React + TypeScript, Tailwind CSS, `@dnd-kit` (drag/drop),
  Yjs + `@liveblocks/client`/`@liveblocks/yjs` (sync), `y-indexeddb` (local
  persistence), `zod` (schema), `date-fns` (date math).
- **Worker:** a single Cloudflare Worker using Liveblocks REST + the secret key,
  configured and deployed with Wrangler.
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
| `OWNER_SECRET` | Worker secret | Gates `POST /api/rooms` and the agent API. Any long random string. |
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

## Agent / import-export API

The trip serializes to a single JSON document — the format the in-app
import/export uses and the agent API reads and writes. The zod schema in
`src/data/tripSchema.ts` is the single source of truth. See
[`docs/trip-schema.md`](./docs/trip-schema.md) for the schema and the agent API
(`GET`/`POST /api/trip/:room`, owner token, example payloads).
