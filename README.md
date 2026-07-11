# Travel Planner

A local-first, collaborative day-board for planning a multi-week trip together. Two people edit the same board in real time: each column is a day, color-coded by city, hosting activity cards on a continuous time scale and accommodation bars spanning nights. Edits persist instantly to local IndexedDB and sync in the background via Liveblocks + Yjs (CRDT). Access is via a secret link (room id in the URL) with no login. An agent can read and write the whole trip over HTTP, visualizing AI-generated plans directly in the board.

## Architecture

The app ships as two independent pieces on Cloudflare:

- **SPA** (Vite + React + TypeScript) — deployed to Cloudflare Pages. Renders and edits on local IndexedDB; syncs in the background via the Worker-authenticated Liveblocks Yjs provider.
- **Worker** (single Cloudflare Worker) — mints Liveblocks access tokens, gates room creation, and exposes the agent HTTP API. Holds the only copies of `LIVEBLOCKS_SECRET_KEY` and `OWNER_SECRET`; neither ever reaches the browser.

The browser talks only to the Worker (for auth, room creation, agent API). Liveblocks also talks to the Worker via the secret key. The room id lives in the URL hash (`#<roomId>`) — the "secret link" — so anyone with the link joins and edits with no login, while creating a *new* room requires the owner secret.

```
Browser (Pages)  ──auth/rooms/trip──▶  Worker  ──REST + secret key──▶  Liveblocks
        │                                                                    ▲
        └────────────── Yjs sync (token-scoped, via Liveblocks) ───────────┘
```

## Stack

- **Client**: Vite + React + TypeScript, Yjs (CRDT), `@liveblocks/client` + `@liveblocks/yjs`, `y-indexeddb` (local persistence), `@dnd-kit` (drag-and-drop), `zod` (schema validation), Tailwind CSS, `date-fns` (date math).
- **Worker**: Cloudflare Workers, Liveblocks REST API with secret key, environment-agnostic shared `src/data/` modules (zod schema, Y.Doc shape, typed mutators, trip apply/export).
- **Tests**: Vitest + React Testing Library + jsdom (unit/integration), Playwright (end-to-end).

## Setup

### Prerequisites

- Node.js 18+, npm.
- A Liveblocks account and project; copy the **secret key** (`sk_...`) from Dashboard → project → API keys.
- Choose an **owner secret** — any long random string. It gates new-room creation and the agent API.

### Development

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Create `.env` for the SPA** (client-side Worker URL for local dev):
   ```sh
   cp .env.example .env
   # .env defaults to http://localhost:8787 (wrangler dev default)
   ```

3. **Create `worker/.dev.vars`** (Worker secrets for local dev):
   ```sh
   cp worker/.dev.vars.example worker/.dev.vars
   # Edit worker/.dev.vars and fill in:
   #   LIVEBLOCKS_SECRET_KEY=sk_dev_... (from your Liveblocks dashboard)
   #   OWNER_SECRET=<your-chosen-long-random-string>
   ```

4. **Start the local Worker:**
   ```sh
   npm run worker:dev    # wrangler dev on http://localhost:8787
   ```

5. **In a separate terminal, start the SPA dev server:**
   ```sh
   npm run dev           # vite on http://localhost:5173
   ```

6. **Open the app:**
   - http://localhost:5173 opens a local-only doc (no sync).
   - Create a room via the UI, which generates a secret link hash (`#<roomId>`).
   - Share that link to co-edit in real time.

### Scripts

- `npm run dev` — start the SPA dev server.
- `npm run build` — build the SPA (`dist/`) and typecheck.
- `npm run preview` — preview the production SPA build.
- `npm test` — run unit and integration tests (Vitest).
- `npm run test:watch` — run tests in watch mode.
- `npm run test:e2e` — run end-to-end tests (Playwright).
- `npm run lint` — lint with ESLint.
- `npm run format` — format with Prettier.
- `npm run coverage` — run tests with coverage report.
- `npm run worker:dev` — start the local Worker (`wrangler dev`).
- `npm run deploy:worker` — deploy the default Worker (for testing).
- `npm run deploy:worker:prod` — deploy the production Worker environment.

## Room Creation and Secret Links

The app has no login. Access is via a **secret link** — a URL containing a room id in the hash.

### Create a new room

From the UI: the app prompts you to create a room (owner-gated via the owner secret set in `worker/.dev.vars`). The browser calls `POST /api/rooms` with the owner secret in the `x-owner-secret` header; the Worker creates the room and returns its id.

From the command line (once deployed):
```sh
curl -X POST https://<worker-url>/api/rooms \
  -H "x-owner-secret: $OWNER_SECRET" \
  -H "content-type: application/json" \
  -d '{}'
# → { "id": "<roomId>" }
```

### Join an existing room

Share the secret link: `https://<app-url>/#<roomId>`. Anyone who clicks it joins that room and can co-edit instantly. No login, no signup.

## Agent API

Agents (or any automated system with the owner secret) can read and write the trip over plain JSON. Both endpoints are owner-gated and perform a **full replace** — the entire trip is cleared and rebuilt from the payload.

### Endpoints

**`GET /api/trip/:roomId`** — read the room's current trip as JSON.

```sh
curl https://<worker-url>/api/trip/<roomId> \
  -H "x-owner-secret: $OWNER_SECRET"
# → { "trip": {...}, "cities": [...], "accommodations": [...], "cards": [...], "dayOverrides": {...} }
```

**`POST /api/trip/:roomId`** — write a trip JSON into the room (full replace).

```sh
curl -X POST https://<worker-url>/api/trip/<roomId> \
  -H "x-owner-secret: $OWNER_SECRET" \
  -H "content-type: application/json" \
  -d @trip.json
# → { "trip": {...}, "cities": [...], "accommodations": [...], "cards": [...], "dayOverrides": {...} }
```

The request payload and response follow the schema documented in [`docs/trip-schema.md`](./docs/trip-schema.md). Validation errors are reported with readable, path-prefixed messages (e.g., `cards.0.dayKey: Expected a date as YYYY-MM-DD`). An invalid POST returns 400 and does not mutate the room.

Connected clients (in the browser) see writes from the agent merge live into the board, thanks to the shared Yjs CRDT.

For payload shape, defaults, field rules, and validation, see [`docs/trip-schema.md`](./docs/trip-schema.md).

## Shared Code

The client and the Worker share environment-agnostic modules in `src/data/` — zod schema, Y.Doc shape, typed mutators, trip apply/export — so they never drift:

- `schema.ts` — plain-JS domain types (Trip, City, Day, Card, Accommodation).
- `doc.ts` — Y.Doc shape + the only sanctioned mutators.
- `tripSchema.ts` — zod schema, the single source of truth for import/export + agent API.
- `applyTrip.ts` — validated trip JSON → doc mutations (full replace).
- `exportTrip.ts` — doc → validated JSON.

Import/export and the agent API both use the same apply/export path, so a trip a human imports and a trip an agent posts are held to identical rules.

## Deployment

See [`docs/deployment.md`](./docs/deployment.md) for the full deployment workflow (Worker secrets, SPA build config, env vars, Pages project setup, and first-room creation).

Quick summary:
1. Set Worker secrets (`LIVEBLOCKS_SECRET_KEY`, `OWNER_SECRET`) with `wrangler secret put`.
2. Deploy the Worker: `npm run deploy:worker:prod`.
3. Deploy the SPA to Cloudflare Pages with `VITE_WORKER_URL` env var pointing to the Worker URL.
4. Create the first room via the API and share the secret link.

## Testing

- **Unit tests** (Vitest): pure logic in `src/data/` (schema validation, doc mutators, city resolution, day generation, trip apply/export).
- **Integration tests** (Vitest): two-doc sync verification (CRDT merge).
- **End-to-end tests** (Playwright): real browser UI flows (create room, add cards, drag, import/export, multi-user sync).

Run them:
```sh
npm test              # unit + integration
npm run test:e2e      # playwright
npm run coverage      # unit + integration coverage report
```

## Data Model

For conventions on the Y.Doc shape, shared mutators, per-user vs. synced state, and auth/room-creation model, see [`CLAUDE.md`](./CLAUDE.md).

## License

MIT.
