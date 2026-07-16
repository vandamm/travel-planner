# Travel Planner

Travel Planner is a local-first, collaborative day board for multi-week trips.
It stores each board in Liveblocks and Yjs, then renders it as a continuous,
city-coloured time plan.

Every trip belongs to one shared library. Cloudflare Access admits the approved
accounts; either account can open, create, list, read, and edit every trip.
Trips use slug URLs such as `https://travel.vansach.me/italy-2027`.

## Architecture

- **Pages app:** Vite, React, and TypeScript render the homepage and trip boards.
- **Worker:** a Cloudflare Worker verifies Access identity, mints room-scoped
  Liveblocks tokens, lists and creates rooms, exposes the trip REST API, and
  serves MCP.
- **Liveblocks:** stores Yjs documents and distributes real-time updates.

The browser and MCP client authenticate through Cloudflare Access. The Worker
holds the Liveblocks secret key; it never reaches the browser.

## Development

Install dependencies, then create local environment files:

```sh
npm install
cp .env.example .env
cp worker/.dev.vars.example worker/.dev.vars
```

Set `LIVEBLOCKS_SECRET_KEY` and `DEV_AUTH_EMAIL` in `worker/.dev.vars`. The
development identity bypasses Cloudflare Access locally and must never be set in
production.

Run the Worker and app in separate terminals:

```sh
npm run worker:dev
npm run dev
```

Open `http://localhost:5173` for a local board or create a shared trip from the
Access-protected homepage.

## REST API

Cloudflare Access protects every endpoint except `GET /api/schema`.

| Method | Path                      | Purpose                                            |
| ------ | ------------------------- | -------------------------------------------------- |
| `GET`  | `/api/rooms`              | List shared trip summaries; supports `?cursor=`.   |
| `POST` | `/api/rooms`              | Create a shared slug room.                         |
| `GET`  | `/api/schema`             | Return the public JSON Schema for a trip document. |
| `GET`  | `/api/trip/:slug`         | Read one shared trip.                              |
| `POST` | `/api/trip/:slug`         | Replace one shared trip with a valid document.     |
| `GET`  | `/api/versions/:slug`     | List saved snapshots.                              |
| `GET`  | `/api/versions/:slug/:id` | Read one snapshot.                                 |

Writes validate the complete document, snapshot the previous version, and then
push the Yjs update to connected clients. See [the trip schema](./docs/trip-schema.md)
for the payload shape and validation rules.

## MCP

Connect an MCP client to:

```text
https://travel.vansach.me/mcp
```

Use Cloudflare Access Managed OAuth. The server exposes four tools:

1. `list_trips` lists shared trip summaries and returns a cursor when more exist.
2. `read_board(slug)` loads the selected trip.
3. `get_schema` returns the exact write schema.
4. `write_board(slug, trip)` replaces the complete trip document.

`write_board` snapshots the previous trip. It does not add individual cards or
merge partial JSON, so read the board and schema before writing.

## Scripts

- `npm run dev` — start Vite.
- `npm run worker:dev` — start the local Worker.
- `npm run build` — type-check and build the app.
- `npm test` — run unit and integration tests.
- `npm run test:e2e` — run Playwright tests.
- `npm run lint` — run ESLint.

## Deployment

See [deployment.md](./docs/deployment.md) for the Access, Worker, Pages, and
MCP deployment procedure.
