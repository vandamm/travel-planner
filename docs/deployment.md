# Deployment

The app ships as two independent pieces on Cloudflare:

1. **The SPA** — a static Vite build (`dist/`) served by **Cloudflare Pages**.
2. **The Worker** (`worker/`) — mints Liveblocks tokens, gates room creation,
   and exposes the agent HTTP API. It holds the only copies of the
   `LIVEBLOCKS_SECRET_KEY` and `OWNER_SECRET`; neither ever reaches the browser.

The browser only ever talks to the Worker (for auth, room creation, and the
agent API). Liveblocks talks to the Worker too, via the secret key. The room id
lives in the URL hash (`#<roomId>`) — the "secret link" — so anyone with the
link can join and edit, while creating a *new* room requires the owner secret.

```
Browser (Pages)  ──auth/rooms──▶  Worker  ──REST + secret key──▶  Liveblocks
        │                                                              ▲
        └────────────── Yjs sync (token-scoped, via Liveblocks) ───────┘
```

## Prerequisites

- A Cloudflare account with Pages and Workers enabled.
- A Liveblocks account and project; copy its **secret key** (`sk_...`) from
  Dashboard → project → API keys.
- An **owner secret** of your choosing — any long random string. It gates
  new-room creation (`POST /api/rooms`) and the agent API (`/api/trip/:room`).
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
npx wrangler secret put OWNER_SECRET          --config worker/wrangler.toml --env production
```

(For the default/test Worker omit `--env production`.)

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

## 3. First room and sharing the secret link

Only the owner can create rooms. With the owner secret, create the first room
against the deployed Worker:

```sh
curl -X POST https://<worker-url>/api/rooms \
  -H "x-owner-secret: $OWNER_SECRET" \
  -H "content-type: application/json" \
  -d '{}'
# → { "id": "<roomId>" }
```

Open the SPA at `https://<pages-url>/#<roomId>` and share that exact URL — the
room id in the hash is the secret link. Anyone with it joins and co-edits with
no login; without the owner secret they cannot create new rooms.

## 4. Agent API smoke test

The agent reads and writes the same room over JSON (owner-gated). See
[`trip-schema.md`](./trip-schema.md) for the payload shape.

```sh
# Read the current trip
curl https://<worker-url>/api/trip/<roomId> -H "x-owner-secret: $OWNER_SECRET"

# Write a trip (full replace) — connected clients converge live
curl -X POST https://<worker-url>/api/trip/<roomId> \
  -H "x-owner-secret: $OWNER_SECRET" \
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
