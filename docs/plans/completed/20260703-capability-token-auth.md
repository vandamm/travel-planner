# Capability-token auth — one signing key, links carry perms + name (Phase 1)

## Overview

Replace the current three-credential model (shared room-id link + `OWNER_SECRET`
+ `MCP_API_KEY`) with **one hidden Worker signing key** and **capability links**.
A link becomes a signed token `{ roomId, perms, name }` where `perms` ∈
`view` | `edit` | `owner`. This:

- **Reduces + hides secrets** (agreed goal A): humans hold links, the Worker
  holds a single `TOKEN_SECRET`. `OWNER_SECRET` and `MCP_API_KEY` are removed.
- **Makes the link the sole capability**: `/api/auth` mints a Liveblocks token
  whose access matches the link's perms (`room:read` for `view`, `room:write`
  for `edit`/`owner`) — so view-only is enforced by Liveblocks, not just hidden.
- **Create-from-in-a-room**: an `owner` token authorizes `POST /api/rooms`, which
  returns a fresh `owner` link. Genesis (room #0) is minted once with a local CLI
  using the signing key.
- **Name in the token** (agreed B): the optional `name` is signed into the token
  and forwarded to Liveblocks as `userInfo` (for future presence). No store; **no
  revocation** in Phase 1 (rotate `TOKEN_SECRET` to invalidate all).

Scope: **Phase 1 = the auth/token core + client wiring + secret collapse.** Owner
UX (in-app "New trip" / "Invite view|edit link") and presence avatars are
follow-on plans (see Post-Completion). Personal scale; expandable later.

**Breaking change (accepted):** the link format changes `#room=<uuid>` →
`#<token>` — the signed token is the whole fragment (no `t=`/`room=` key). Existing
links stop working — fine, only throwaway test data exists. Hard-cut, no dual-support
code. (`parseToken` treats the bare fragment as the token; an old `#room=…` fragment
fails to decode → `NoRoom` notice.)

## Context (from discovery)

- **Worker (`worker/src/`):**
  - `rooms.ts` `handleCreateRoom` — gated by `OWNER_SECRET`; creates a Liveblocks room.
  - `auth.ts` `handleAuth` — takes `{ room }`, mints a token for an existing room
    (always `room:write`, identity `guest-<room>`).
  - `liveblocks.ts` — `Env` (holds `LIVEBLOCKS_SECRET_KEY`, `OWNER_SECRET`,
    `MCP_API_KEY`, `ALLOWED_ORIGIN`, `SNAPSHOTS`); `mintAccessToken(roomId, userId)`
    calls `/v2/authorize-user` with `permissions: { [roomId]: ['room:write'] }`.
  - `trip.ts` — `GET`/`POST /api/trip/:room`, `GET /api/schema`; `ownerAuthorized`
    (`x-owner-secret`). Exposes `loadRoomDoc`, `applyTripToRoom`.
  - `mcp.ts` — `handleMcp`; `mcpAuthorized` (`MCP_API_KEY` bearer); tools
    `get_schema` / `read_board(link)` / `write_board(link, trip)`; resolves rooms
    via `roomIdFromLink` + `roomExists`.
  - `index.ts` — router + CORS (`x-owner-secret` in allowed headers).
- **Shared (`src/data/`):**
  - `roomLink.ts` — pure `roomIdFromHash` / `roomIdFromLink` (used by client +
    Worker). This is where token encode/decode belongs (stays browser/Worker-safe).
  - `provider.ts` — `connectRoom`, and a Liveblocks `authEndpoint` that POSTs
    `{ room }` to `/api/auth`.
  - `RoomProvider.tsx` — derives room id from the hash, mounts the connection.
  - `App.tsx` — `roomIdFromHash(location.hash)` gate (renders `NoRoom` when absent).
- **Related patterns:** Web Crypto (`crypto.subtle` HMAC-SHA256) is available in
  both the Workers runtime and browsers; **only the Worker holds the key** — the
  client *decodes* the token payload (no verify) for local rendering. Worker unit
  tests inject a `LiveblocksApi` fake; sync is checked with two-`Y.Doc` tests;
  e2e runs offline (sync disabled) and will use an unsigned-payload token link.
- **Dependencies:** none new. HMAC via Web Crypto; base64url by hand.

## Development Approach

- **TDD** (red-green) per CLAUDE.md. Vitest for pure token/data logic; Worker unit
  tests with the `LiveblocksApi` fake; Playwright e2e for the client link flow.
- Complete each task fully (impl + tests green) before the next.
- **CRITICAL:** every task adds/updates tests (success + error paths); all tests
  pass before moving on; update this plan if scope shifts.
- Security-sensitive: sign/verify must have tamper + wrong-key + malformed tests.

## Testing Strategy

- **Unit (Vitest):** token encode/decode/sign/verify (roundtrip, tamper, wrong
  key, malformed, missing fields); perms→Liveblocks-scope mapping; link parse.
- **Worker unit (`LiveblocksApi` fake):** `/api/auth` perm mapping + `userInfo`;
  `POST /api/rooms` owner-token gate; MCP tool perm checks; `/api/trip` token gate.
- **Integration (two `Y.Doc`):** MCP `write_board` still merges.
- **E2E (Playwright):** a `#<token>` link loads the board; `view` hides edit
  affordances (deferred to Phase 2 — Phase 1 e2e just asserts a token link loads
  and an `edit` link edits). Add a shared token-builder test helper.

## Progress Tracking

- Mark `[x]` on done items immediately; ➕ for new tasks, ⚠️ for blockers.

## What Goes Where

- **Implementation Steps** (`[ ]`): code + tests + docs in this repo.
- **Post-Completion** (no checkboxes): deploy secret changes, prod re-bootstrap,
  and the Phase 2 / Phase 3 follow-on plans.

## Implementation Steps

### Task 1: Capability-token module (encode/decode shared, sign/verify Worker-side)
- [x] In `src/data/token.ts` (shared, no browser/Worker-only APIs beyond Web
      Crypto): define the payload type `{ r: roomId, p: 'view'|'edit'|'owner', n?: name, slug?: string, v: 1 }`,
      `encodePayload`/`decodePayload` (base64url JSON), and `parseToken(hash|link)`
      → payload | null (decode only, NO verify — for client rendering). `slug` is
      carried for the Phase-2 memorable-link path canonicalization; unused in Phase 1.
- [x] In `worker/src/token.ts` (Worker-only): `signToken(payload, secret)` and
      `verifyToken(token, secret)` using `crypto.subtle` HMAC-SHA256; token form
      `<base64url(payload)>.<base64url(sig)>`; constant-time-ish compare.
- [x] Write Vitest for encode/decode/parse (roundtrip, malformed, missing room).
- [x] Write Worker unit tests for sign→verify (roundtrip, tampered payload, wrong
      key, malformed) — must reject all bad inputs.
- [x] Run `npm test` — pass before Task 2.

### Task 2: `/api/auth` — verify token, mint perm-scoped Liveblocks token + name
- [x] `liveblocks.ts`: extend `mintAccessToken(roomId, userId, opts)` to take the
      Liveblocks access (`'room:read' | 'room:write'`) and optional `userInfo` (name),
      passed through to `/v2/authorize-user`.
- [x] `auth.ts`: accept `{ token }`; `verifyToken` (401 on invalid); derive roomId
      + perms + name; require the room exists; map `view`→read, `edit`/`owner`→write;
      mint with the name as `userInfo`. Keep returning `{ token }`.
- [x] Write Worker unit tests: `view`→read scope, `edit`/`owner`→write scope,
      invalid/absent token→401, name flows into the mint call, unknown room→403.
- [x] Run `npm test` — pass before Task 3.

### Task 3: `POST /api/rooms` — create-from-in-a-room via an owner token
- [x] `rooms.ts`: replace the `OWNER_SECRET` gate with a valid **`owner`** token
      (Authorization: Bearer) via `verifyToken`; create the room; **sign and return
      a fresh `owner` token/link** for the new room (`{ id, token }`).
- [x] Non-owner perms (`view`/`edit`) and absent/invalid token → 401.
- [x] Write Worker unit tests (owner token → 201 + new owner token; edit/view/none → 401).
- [x] Run `npm test` — pass before Task 4.

### Task 4: MCP — authorize tool calls by the link's token perms; drop `MCP_API_KEY`
- [x] `mcp.ts`: remove `mcpAuthorized`/`MCP_API_KEY`. In `resolveRoom` (or a new
      guard), `verifyToken` the passed link; `read_board` requires `view`+,
      `write_board` requires `edit`+; return a clear tool error on invalid/insufficient.
- [x] `initialize`/`tools/list` stay open (discovery is harmless; actions need a token).
- [x] Update Worker unit tests: valid `edit` token writes; `view` token cannot write;
      invalid/expired token → tool error; keep the two-`Y.Doc` merge test.
- [x] Confirm the end-to-end agent flow: given a pasted `edit`/`owner` link (the
      sole credential — no separate key), `read_board` returns the trip and
      `write_board` applies + snapshots; a `view` link reads but cannot write.
      (Confirmed via Worker unit tests — offline, per the local-first test model.)
- [x] Run `npm test` — pass before Task 5.

### Task 5: Agent HTTP API — re-gate `/api/trip/:room` with a token; open `/api/schema`
- [x] `trip.ts`: replace `ownerAuthorized` (`x-owner-secret`) with a Bearer capability
      token; `GET` requires `view`+, `POST` requires `edit`+, and the token's roomId
      must match `:room`. Make `GET /api/schema` public (drop its gate — schema isn't secret).
- [x] `index.ts`: drop `x-owner-secret` from CORS allowed headers.
- [x] Write Worker unit tests (token perm + room-match for GET/POST; schema is public).
- [x] Run `npm test` — pass before Task 6.

### Task 6: Client — parse the token link, thread perms/name, send token to `/api/auth`
- [x] `roomLink.ts`/`token.ts`: client reads `#<token>` → `parseToken` → roomId
      (+ perms, name) with no verify.
- [x] `provider.ts`: `authEndpoint` POSTs `{ token }` (from the hash) instead of `{ room }`.
- [x] `RoomProvider.tsx`: derive roomId from the token; expose perms + name in context.
- [x] `App.tsx`: gate on a parseable token (no token → existing `NoRoom` notice).
- [x] Add a shared token-builder helper for tests/e2e (unsigned payload is fine —
      the client only decodes). Update `e2e/*` links `#room=e2e` → `#<built token>`
      and unit tests accordingly.
- [x] Write unit tests (RoomProvider derives room/perms from a token) + e2e (a token
      link loads the board; an `edit` link can add a city). Run `npm test` + `npm run test:e2e`.

### Task 7: Genesis mint CLI + collapse secrets to `TOKEN_SECRET`
- [x] Add a local script (e.g. `scripts/mint-token.ts`, run via `tsx`/node) that
      signs a token for `{ roomId, perms, name }` using `TOKEN_SECRET` from the
      environment/`.dev.vars` — for bootstrapping room #0 and any manual link.
- [x] `liveblocks.ts` `Env`: add `TOKEN_SECRET`; remove `OWNER_SECRET` and `MCP_API_KEY`.
- [x] Update `worker/wrangler.toml` comments, `worker/.dev.vars.example` (add
      `TOKEN_SECRET`, drop the other two).
- [x] Write a unit test for the mint script's signing (matches `verifyToken`).
- [x] Run `npm test` — pass before Task 8.

### Task 8: Verify acceptance criteria
- [x] Verify: a token link joins with matching access; `view` gets `room:read`
      (Liveblocks rejects writes); create needs an `owner` token; MCP/HTTP honor
      perms; no `OWNER_SECRET`/`MCP_API_KEY` remain in code or config. (Behavioral
      items covered by the Worker unit tests from Tasks 2–5 + e2e token-link smoke;
      removed the last code remnant — the dead client `createRoom`/`x-owner-secret`
      helper — and cleaned `.dev.vars` to `TOKEN_SECRET` only. Grep confirms only the
      negative test assertion `not.toContain('x-owner-secret')` remains.)
- [x] Run full `npm test` (509 pass) + `npm run test:e2e` (45 pass).
- [x] Run `npm run lint` (0 errors; 3 pre-existing react-refresh warnings, unrelated);
      `npx tsc --noEmit` clean.
- [x] `npm run coverage` — 90.83% aggregate (`token.ts` 96.66%, `roomLink.ts` 90.47%);
      `src/data`/logic ~90% standard maintained.

### Task 9: Update documentation
- [x] `CLAUDE.md` "Auth / room-creation model" — rewrite for capability tokens +
      single `TOKEN_SECRET`. (Also refreshed the shared-modules list: added a
      `token.ts` entry and corrected the now-legacy `roomLink.ts` note.)
- [x] `docs/deployment.md`, `docs/trip-schema.md`, `README.md` (agent API + MCP
      setup) — replace `OWNER_SECRET`/`MCP_API_KEY` with the token model + genesis step.
      (Bearer capability token for `/api/trip`, public `/api/schema`, keyless MCP with
      per-tool link auth, and the `scripts/mint-token.ts` genesis flow in deployment.)

## Technical Details

- **Token:** `<base64url(JSON payload)>.<base64url(HMAC-SHA256(payload, TOKEN_SECRET))>`.
  Payload `{ r, p, n?, slug?, v:1 }` (`slug` = memorable path label used by the Phase-2
  canonicalizer; the token itself still lives in the fragment). Compact enough for a URL
  hash. No expiry in Phase 1 (add `exp` later if wanted).
- **Perms → Liveblocks:** `view`→`['room:read']`, `edit`/`owner`→`['room:write']`.
  `owner` additionally authorizes `POST /api/rooms`.
- **Enforcement split:** Liveblocks enforces read/write on live sync (via the minted
  token); the Worker enforces create + HTTP/MCP perms (via `verifyToken`). The client
  decodes (unverified) only to shape local rendering/UX — no security rests on it.
- **Bootstrap:** run the mint CLI once with an `owner` perm to produce room #0's link;
  thereafter create-from-in-room chains.

## Post-Completion

*Manual / external — no checkboxes.*

**Deploy secret changes:**
- Set `TOKEN_SECRET` on dev + prod Workers (`wrangler secret put TOKEN_SECRET --env …`,
  or a fresh long random value); **delete** `OWNER_SECRET` and `MCP_API_KEY` secrets.
- Redeploy both Workers with `npm run deploy:worker[:prod]` (no `--secrets-file`).
- **Re-bootstrap prod:** old `#room=` links (incl. the current prod test room) are
  dead; mint a new genesis `owner` link and use/share that.
- Re-point the Perplexity MCP connector: it no longer needs the API key; it just
  needs a board's (edit/owner) share link pasted into the chat.

**Follow-on plans (out of scope here):**
- **Phase 2 — Owner UX + memorable links:** in-app "New trip" (calls `POST /api/rooms`,
  shows the new owner link) and "Invite → copy view|edit link" (mint a scoped participant
  token); client hides edit affordances for `view` perms. **Memorable links:** set a
  `slug` in the token at mint time; the client canonicalizes the path to
  `https://<domain>/<slug>/#<token>` via `history.replaceState`, backed by an SPA-fallback
  rewrite on Pages (any `/<slug>/` serves `index.html`). The token stays in the fragment
  (off the wire) — no localStorage. Deploy: attach the custom domain (`trips.vansach.com`)
  and set `ALLOWED_ORIGIN` to it.
- **Phase 3 — Presence:** surface Liveblocks `userInfo` (the token `name`) as
  stacked avatars / "who's editing" indicators.
- **Phase 4 (if wanted) — Public read-only:** after a trip, "publish" it as a **static
  snapshot** at the bare `/<slug>/` (no token) — a frozen export, not a live anon-read
  room. Needs slug→artifact resolution (a small store) and an explicit opt-in publish
  (public slugs are guessable). Keep it static to avoid live exposure + anon tokens.
- **Later, if it grows past personal:** per-participant revocation (a grants store /
  short-lived tokens), token expiry.
