# Deployment

The app ships as two independent pieces on Cloudflare:

1. **The SPA** — a static Vite build (`dist/`) served by **Cloudflare Pages**.
2. **The Worker** (`worker/`) — mints Liveblocks tokens, gates room creation,
   and exposes the agent HTTP + MCP API. It holds the only copies of
   `LIVEBLOCKS_SECRET_KEY` and `TOKEN_SECRET` (the capability-link signing key);
   neither ever reaches the browser. It also owns a **KV namespace**
   (`SNAPSHOTS`) of trip-version history.

The browser only ever talks to the Worker (for auth, room creation, and the
agent API). Liveblocks talks to the Worker too, via the secret key. A share link
is a **signed capability token** carried in the URL hash (`#<token>`) that grants
`view`, `edit`, or `owner` on one room — anyone with a link joins at its perm
level, while creating a *new* room requires an `owner` token.

```
Browser (Pages)  ──auth/rooms──▶  Worker  ──REST + secret key──▶  Liveblocks
        │                                                              ▲
        └────────────── Yjs sync (token-scoped, via Liveblocks) ───────┘
```

## Prerequisites

- A Cloudflare account with Pages and Workers enabled.
- A Liveblocks account and project; copy its **secret key** (`sk_...`) from
  Dashboard → project → API keys.
- A **token secret** of your choosing — any long random string. This single HMAC
  key signs and verifies every capability link, so it gates all access: joining a
  room (`/api/auth`), new-room creation (`POST /api/rooms`, an `owner` token), and
  the agent HTTP + MCP API. Rotating it invalidates every **token-verified**
  capability (those three). It does **not** cut off the room-id-gated
  version-history endpoints (`/api/versions/:room`), which verify no token —
  anyone who still knows a room id can list/restore its snapshots after rotation.
- `wrangler` is installed as a dev dependency, so all commands below run through
  `npm run …` / `npx wrangler …` without a global install.

## 1. Deploy the Worker

The Worker config is `worker/wrangler.toml`. All commands point at it with
`--config` so they can be run from the repo root.

### Set the secrets (once per environment)

Secrets are encrypted and stored by Cloudflare — never committed. Set them for
the **production** environment:

```sh
npx wrangler secret put LIVEBLOCKS_SECRET_KEY --config worker/wrangler.toml --env production
npx wrangler secret put TOKEN_SECRET          --config worker/wrangler.toml --env production
```

(For the default/test Worker omit `--env production`.) `TOKEN_SECRET` verifies
every link; leave it unset and no link can be verified, so all access is rejected.

### Create the snapshot KV namespace

Trip-version history (the "Recent versions" restore list, and snapshot-before-write
for every AI/owner write) is backed by a KV namespace bound as `SNAPSHOTS`.
`worker/wrangler.toml` ships with placeholder ids — create the real namespaces and
paste the printed ids in, or `wrangler deploy` fails on the bad binding:

```sh
npx wrangler kv namespace create SNAPSHOTS --config worker/wrangler.toml
npx wrangler kv namespace create SNAPSHOTS --config worker/wrangler.toml --env production
```

Paste each printed id into the matching `[[kv_namespaces]]` / `[[env.production.kv_namespaces]]`
block in `worker/wrangler.toml`. (If the binding is absent the handlers still work —
writes just skip history and `GET /api/versions/:room` returns an empty list — but the
placeholder id must be replaced or removed, since a non-existent id errors the deploy.)

### Pin the CORS origin

In `worker/wrangler.toml`, set `[env.production.vars].ALLOWED_ORIGIN` to your
Pages URL (e.g. `https://travel-planner.pages.dev`) so only the deployed SPA can
call the Worker. Left unset, the Worker reflects the request Origin — fine for
local dev, too loose for production.

### Deploy

```sh
npm run deploy:worker:prod    # wrangler deploy --env production
```

This publishes `travel-planner-worker-production` and prints its URL
(`https://travel-planner-worker-production.<subdomain>.workers.dev`). Note that
URL — it is the Worker base URL the SPA needs next.

`npm run deploy:worker` deploys the top-level Worker for quick throwaway tests;
the production env is the one to share.

To serve the Worker from your own domain instead of `*.workers.dev`, uncomment
the `[[env.production.routes]]` block in `worker/wrangler.toml`, set
`workers_dev = false`, and redeploy.

### Local Worker dev

```sh
cp worker/.dev.vars.example worker/.dev.vars   # then fill in real values
npm run worker:dev                              # wrangler dev on http://localhost:8787
```

`worker/.dev.vars` is gitignored; it provides the secrets to `wrangler dev`.

## 2. Deploy the SPA to Cloudflare Pages

### Pages build configuration

Create a Pages project connected to this repo with:

| Setting | Value |
| --- | --- |
| **Build command** | `npm run build`  (runs `tsc --noEmit && vite build`) |
| **Build output directory** | `dist` |
| **Root directory** | repo root (default) |
| **Environment variable** | `VITE_WORKER_URL` = your deployed Worker base URL |

`VITE_WORKER_URL` is read at build time (it is a `VITE_`-prefixed client var, so
it is baked into the bundle — only put the Worker's public URL here, never a
secret). Set it to the production Worker URL from step 1, e.g.
`https://travel-planner-worker-production.<subdomain>.workers.dev`.

### Deploy

Pushing to the connected branch triggers a Pages build automatically. To deploy
the prebuilt output manually instead:

```sh
npm run build
npx wrangler pages deploy dist --project-name travel-planner
```

After the first deploy, go back and set `ALLOWED_ORIGIN` (step 1) to the Pages
URL and redeploy the Worker.

## 3. Genesis room and sharing capability links

Creating a room needs an `owner` token, so bootstrap the first ("genesis") one
locally with the mint CLI. **Sign it with the exact `TOKEN_SECRET` you set on the
target Worker** (step 1) — a token signed with any other value (e.g. a different
`worker/.dev.vars` secret) is rejected by the deployed Worker with a 401. Pick a
room id, then:

```sh
ROOM=$(uuidgen)                                   # or any string you like
# Sign with the SAME secret set on the target Worker (step 1), else /api/rooms 401s.
OWNER=$(TOKEN_SECRET='<the value you set in step 1>' npx tsx scripts/mint-token.ts "$ROOM" owner)

# Create the Liveblocks room with that owner token
curl -X POST https://<worker-url>/api/rooms \
  -H "authorization: Bearer $OWNER" \
  -H "content-type: application/json" \
  -d "{\"room\": \"$ROOM\"}"
# → { "id": "<roomId>", "token": "<a fresh owner token for it>" }
```

Open the SPA at `https://<pages-url>/#<token>` and share that exact URL — the
token in the hash *is* the capability link. Anyone with it joins at the token's
perm level (no login). To hand out narrower access, mint a `view` or `edit` token
for the same room (`npx tsx scripts/mint-token.ts "$ROOM" edit`) and share
`#<that token>`. Rooms created from inside the app (`POST /api/rooms` with an
owner link) return their own fresh owner link, so ownership chains — the genesis
mint is a one-time step.

## 4. Agent API smoke test

The agent reads and writes the same room over JSON, gated by a capability token
(`view`+ to read, `edit`+ to write) whose room matches the path. See
[`trip-schema.md`](./trip-schema.md) for the payload shape.

```sh
# Read the current trip
curl https://<worker-url>/api/trip/$ROOM -H "authorization: Bearer $OWNER"

# Write a trip (full replace) — connected clients converge live
curl -X POST https://<worker-url>/api/trip/$ROOM \
  -H "authorization: Bearer $OWNER" \
  -H "content-type: application/json" \
  -d @trip.json
```

## Verifying config without deploying

Both builds can be checked locally with no live deploy:

```sh
npm run build                                                   # SPA: tsc + vite build → dist/
npx wrangler deploy --config worker/wrangler.toml --dry-run     # default Worker bundle
npx wrangler deploy --config worker/wrangler.toml --env production --dry-run   # production env
```
