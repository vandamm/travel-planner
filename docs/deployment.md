# Deployment

The app ships on Cloudflare:

1. **Pages** serves the Vite build and slug URLs such as `/italy-2027`.
2. **The Worker** serves `/api/*` and `/mcp`, mints Liveblocks tokens, writes trip
   JSON, and stores version snapshots in KV.
3. **Cloudflare Access** protects `travel.vansach.me/*` and allows only the two
   approved Google accounts.

## Prerequisites

- Cloudflare zone for `travel.vansach.me`.
- Cloudflare Zero Trust organization with Google login enabled.
- Liveblocks project secret key (`sk_...`).
- Access application audience tag for `travel.vansach.me/*`.
- `SNAPSHOTS` KV namespace for version history.

## 1. Worker

Set the Worker secret:

```sh
npx wrangler secret put LIVEBLOCKS_SECRET_KEY --config worker/wrangler.toml --env production
```

Create/update the snapshot KV namespace:

```sh
npx wrangler kv namespace create SNAPSHOTS --config worker/wrangler.toml --env production
```

Put the printed namespace id in `worker/wrangler.toml`.

Set production vars in `worker/wrangler.toml`:

- `ACCESS_TEAM_DOMAIN = "https://<team>.cloudflareaccess.com"`
- `ACCESS_AUD = "<Access application AUD tag>"`
- `ALLOWED_ORIGIN = "https://travel.vansach.me"`

Production should use custom-domain routes, not `*.workers.dev`, so Access cannot
be bypassed:

```toml
[env.production]
workers_dev = false

[[env.production.routes]]
pattern = "travel.vansach.me/api/*"
zone_name = "vansach.me"

[[env.production.routes]]
pattern = "travel.vansach.me/mcp"
zone_name = "vansach.me"
```

Deploy:

```sh
npm run deploy:worker:prod
```

## 2. Pages

Cloudflare Pages settings:

| Setting                | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| Build command          | `npm run build`                                        |
| Build output directory | `dist`                                                 |
| Root directory         | repo root                                              |
| Environment variable   | leave `VITE_WORKER_URL` unset for same-origin `/api/*` |

The committed `public/_redirects` file makes direct slug visits serve
`index.html`.

## 3. Cloudflare Access

Create one self-hosted Access application:

- Domain: `travel.vansach.me/*`
- Identity provider: Google
- Policy: Allow only the two approved email addresses
- Enable Managed OAuth for MCP clients

The Worker validates `Cf-Access-Jwt-Assertion` for `/api/*` and `/mcp`. Browser
requests also carry the Access session cookie handled by Cloudflare.

## 4. Existing Room Migration

Rename the existing Liveblocks room to the desired slug manually:

```sh
curl -X POST https://api.liveblocks.io/v2/rooms/<oldRoomId>/update-room-id \
  -H "authorization: Bearer $LIVEBLOCKS_SECRET_KEY" \
  -H "content-type: application/json" \
  -d '{ "newRoomId": "italy-2027" }'
```

After that, open `https://travel.vansach.me/italy-2027`.

## 5. Agent API Smoke Test

After signing in through Access:

```sh
curl https://travel.vansach.me/api/trip/italy-2027
```

For MCP, connect the client to:

```txt
https://travel.vansach.me/mcp
```

Use Cloudflare Access Managed OAuth, then call `list_trips` to choose a slug.
Call `read_board`, `get_schema`, and `write_board` with that slug and the full
replacement document.

## Verify Without Deploying

```sh
npm run build
npx wrangler deploy --config worker/wrangler.toml --env production --dry-run
```
