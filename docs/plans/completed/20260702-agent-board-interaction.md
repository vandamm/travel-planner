# Agent ↔ Board Interaction (Perplexity read + update, with rollback)

## Overview

Let a non-technical user (primary case: a spouse on **Perplexity Pro**) read a
trip board and update it with an AI agent, and make AI edits low-risk with a
durable, restorable history. Two capabilities plus two safety layers:

1. **Trip-settings JSON panel** — show the current board JSON (copy) + paste an
   updated one and apply. Zero setup; works on any Perplexity tier (manual loop).
2. **MCP connector on the Worker** — `read_board`/`write_board`/`get_schema`
   tools so Perplexity Pro reads + updates from a pasted link. Owner secret stays
   Worker-side.
3. **Keep-all JSON snapshot history + restore** — every Worker-mediated write is
   snapshotted first; restore any prior version. Makes a bad AI edit a one-click
   revert.
4. **`Y.UndoManager`** — live Cmd/Ctrl+Z undo/redo for hand editing (session).

Integrates with the existing agent HTTP API (`worker/src/trip.ts`) and the shared
`exportTrip`/`applyTrip`/`tripSchema` modules — no API redesign, owner-gating
unchanged. Full design + rejected alternatives: see "Design decisions" below
(condensed from the brainstorming spec, which this plan supersedes).

## Context (from discovery)

- **Files/components involved:**
  - Client: `src/features/trip/TripModal.tsx` (add JSON panel), `src/data/applyTrip.ts`
    (add distinct transaction origin), a new UndoManager hook under `src/features/board/`,
    and its wiring in `src/features/board/Board.tsx` / `App.tsx`.
  - Worker: new `worker/src/mcp.ts` (MCP-over-HTTP endpoint), new
    `worker/src/snapshots.ts` (KV snapshot store), edits to `worker/src/index.ts`
    (routes), `worker/src/trip.ts` (snapshot-before-write + version endpoints),
    `worker/wrangler.toml` (KV binding), `worker/.dev.vars.example` (`MCP_API_KEY`).
  - Shared: extract the pure `roomIdFromHash` out of `src/data/provider.ts` (which
    has browser-only imports) into a Worker-safe module so the MCP tools parse the
    pasted link with the *same* logic the client uses (no drift).
- **Related patterns found:**
  - `exportTrip(doc)` / `applyTrip(doc, parsed)` / `tripDocumentSchema` +
    `parseTripText` / `formatTripErrors` are environment-agnostic and reused by
    both client and Worker — the panel, MCP, and restore all build on them.
  - `handleGetTrip` / `handlePostTrip` / `handleGetSchema` (`worker/src/trip.ts`)
    already do load-doc / export / validate+apply / diff-to-Liveblocks; MCP tools
    reuse this logic.
  - `/api/auth` treats "knows the room id" as the co-edit capability — the
    link-gated version endpoints mirror this model.
  - Worker tests use a `LiveblocksApi` fake (`worker/src/*.test.ts`); sync is
    verified with two-`Y.Doc` merge tests, not Liveblocks mocks.
  - Mutators run `doc.transact(fn)` at the **null origin** (confirmed in
    `src/data/doc.ts`); the Liveblocks provider applies remote updates under its
    own origin — so `UndoManager` tracks local edits and ignores remote by default.
- **Dependencies identified:** ~~`@modelcontextprotocol/sdk`~~ — **not added** (see
  Task 2 note): the SDK's Streamable-HTTP server transport targets Node http, not
  the Workers Fetch runtime, so `/mcp` is a hand-rolled JSON-RPC 2.0 handler (no new
  dependency). `zod-to-json-schema` already present. Cloudflare **KV** binding for
  snapshots (Task 3).

## Development Approach

- **Testing approach**: TDD (red-green), per CLAUDE.md. Prefer Playwright e2e for
  UI; Vitest for pure `src/data` logic; two-`Y.Doc` integration for sync.
- Complete each task fully before the next; small, focused changes; keep desktop +
  existing API behaviour unchanged.
- **CRITICAL: every task MUST include new/updated tests** (success + error cases).
- **CRITICAL: all tests pass before starting the next task.**
- **CRITICAL: update this plan when scope changes during implementation.**
- Reuse the shared data modules everywhere; do not duplicate schema/export/apply.

## Testing Strategy

- **Unit (Vitest)**: panel validate+apply over `parseTripText`/`applyTrip`;
  `roomIdFromHash` link parsing (full `#room=` URL, bare `#id`, junk); snapshot
  store (record/list/get); `UndoManager` origin handling (local edit undoable,
  `applyTrip` origin excluded).
- **Worker unit** (with `LiveblocksApi` fake): MCP `tools/list`, `get_schema`,
  `read_board`, `write_board`, `MCP_API_KEY` auth; snapshot-before-write; link-gated
  version list/get endpoints.
- **Integration (two `Y.Doc`)**: MCP `write_board` update merges into a second doc.
- **E2E (Playwright)**: JSON panel (show current, copy, paste+apply valid/invalid,
  replace confirm); "Recent versions → Restore"; Cmd/Ctrl+Z undo + redo on a hand edit.

## Progress Tracking

- Mark completed items `[x]` immediately. Add discovered tasks with ➕, blockers with ⚠️.
- Keep this plan in sync with actual work.

## What Goes Where

- **Implementation Steps** (`[ ]`): code + tests + docs achievable in this repo.
- **Post-Completion** (no checkboxes): manual verification, deploy config, and the
  optional panel-apply-into-history extension.

## Implementation Steps

### Task 1: Trip-settings "Trip JSON" panel (show current + paste-apply)
- [x] Add a collapsible "Trip JSON (for AI)" disclosure to `src/features/trip/TripModal.tsx` (low-prominence).
- [x] Show pretty-printed `exportTrip(doc)` with a **Copy** button.
- [x] Add a paste textarea + **Apply** → `parseTripText`/`tripDocumentSchema` → `applyTrip(doc, parsed)`; render `formatTripErrors` on invalid input; guard Apply behind a "replace the whole trip?" confirm.
- [x] Add a distinct transaction origin to `src/data/applyTrip.ts` (e.g. an exported `APPLY_TRIP_ORIGIN`; pass it to `doc.transact`) — consumed by Task 5's UndoManager exclusion.
- [x] Write Vitest for the apply logic (valid → doc updated; invalid → errors, doc untouched).
- [x] Write Playwright e2e (open Trip settings → panel shows current JSON, Copy works, paste valid applies, paste invalid shows error, confirm gates apply).
- [x] Run `npm test`, `npm run test:e2e`, `npm run lint` — all pass before Task 2.

### Task 2: MCP endpoint on the Worker — `get_schema` + `read_board`
- [x] Extract pure `roomIdFromHash` from `src/data/provider.ts` into a Worker-safe shared module (`src/data/roomLink.ts`, + `roomIdFromLink` for full share links); re-export from `provider.ts` so the client is unchanged.
- [x] Add `worker/src/mcp.ts`: MCP-over-HTTP (JSON-RPC 2.0), mounted at `/mcp` via `worker/src/index.ts`; gate with `MCP_API_KEY` (add to `Env` + `worker/.dev.vars.example`). ⚠️ Scope change: hand-rolled the JSON-RPC handshake (`initialize`/`tools/list`/`tools/call`/notification+ping acks) instead of adding `@modelcontextprotocol/sdk` — the SDK's Streamable-HTTP *server* transport is built on Node's http req/res and does not run on the Workers Fetch runtime; the surface we need is tiny and fully unit-testable. Upgrade path: adopt the SDK if a Workers-compatible transport lands or SSE server-push is needed.
- [x] Implement `get_schema` tool (`zodToJsonSchema(tripDocumentSchema)`) and `read_board(link)` (parse room id via `roomIdFromLink`, reuse the exported `loadRoomDoc` + `exportTrip` path).
- [x] Write Worker unit tests (with the `LiveblocksApi` fake): `tools/list`, `get_schema`, `read_board` incl. link parsing + missing/invalid room + `MCP_API_KEY` auth (401 without); plus router-wiring tests in `index.test.ts` and pure `roomLink` unit tests.
- [x] Run `npm test`, `npm run lint` — all pass before Task 3.

### Task 3: MCP `write_board` + snapshot-before-write
- [x] Add `worker/src/snapshots.ts` (KV): `recordSnapshot(room, json)` (timestamped, keep-all), `listSnapshots(room)`, `getSnapshot(room, id)`; add the KV binding to `worker/wrangler.toml`. (KV typed as a minimal `SnapshotKv` slice — no `@cloudflare/workers-types` dep; room encoded into the key so `a` vs `a:b` can't collide.)
- [x] Add `write_board(link, trip)` to `worker/src/mcp.ts`: parse room, validate (`tripDocumentSchema`), **record pre-write snapshot**, `applyTrip`, diff + `sendYUpdate` (reuse `handlePostTrip` logic — extracted the shared write into `applyTripToRoom` in `trip.ts`, used by both the owner POST and `write_board`).
- [x] Snapshot pre-write in `POST /api/trip/:room` too, so both Worker write paths capture history. (Both route through `applyTripToRoom`; snapshotting is guarded on the KV binding being present so handlers still work unbound.)
- [x] Write two-`Y.Doc` integration test (write merges into a second doc) + unit tests (snapshot recorded before write; snapshot store record/list/get; invalid payload → 400, no mutation, no snapshot).
- [x] Run `npm test`, `npm run lint` — all pass before Task 4. (444 client + 51 worker tests pass; lint clean; worker tsc clean.)

### Task 4: Version list + restore (link-gated endpoints + panel UI)
- [x] Add link-gated (room-id-as-capability, mirroring `/api/auth`) endpoints: `GET /api/versions/:room` (list `{id, timestamp}`) and `GET /api/versions/:room/:id` (that snapshot's JSON). (`handleListVersions`/`handleGetVersion` in `trip.ts`; routed in `index.ts`; unknown room → 404, KV-unbound → empty list; no owner secret.)
- [x] In the Trip-settings panel, add a "Recent versions" list; selecting one fetches its JSON and restores by feeding it through the **existing paste-apply path** (with the replace confirm) — restore reuses Task 1's apply, and is itself snapshotted on the next write. (Extracted `applyJsonText`; section gated on `roomId`; `workerUrl` now exposed on `RoomContextValue`, `''` → relative fetch.)
- [x] Write Worker unit tests (list/get, link auth, unknown room/id) + Playwright e2e (make a change, restore an earlier version, board reverts).
- [x] Run `npm test`, `npm run test:e2e`, `npm run lint` — all pass before Task 5. (454 unit + 42 e2e pass; lint 0 errors; worker tsc clean.)

### Task 5: `Y.UndoManager` live undo/redo
- [x] Add a client hook creating a `Y.UndoManager` scoped to the top-level types (`trip`, `cities`, `cards`, `accommodations`, `dayOverrides`); exclude `APPLY_TRIP_ORIGIN` from tracked origins so full-replace/restore isn't chunked into the keystroke stack. (`src/features/board/undoManager.ts`: `createTripUndoManager` + `useUndoManager`; `trackedOrigins` stays the default `{null}`, so string-origin `APPLY_TRIP_ORIGIN` applies and remote sync are excluded by construction.)
- [x] Wire Cmd/Ctrl+Z (undo) and Shift+Cmd/Ctrl+Z (redo) + optional toolbar buttons in `Board.tsx`/`App.tsx`; reflect enabled/disabled state. (Hook wired in `Board.tsx` with ↶/↷ toolbar buttons disabled on empty stacks; the keydown listener skips text fields so native input-undo still works. ⚠️ Hook owns the manager in a `useEffect`/`useState`, not `useMemo` — under StrictMode the mount→cleanup→remount cycle would otherwise leave a `destroy()`ed manager that no longer tracks edits.)
- [x] Write Vitest (local mutation is undoable/redoable; a change at `APPLY_TRIP_ORIGIN` is NOT on the stack) + Playwright e2e (edit a card → undo restores → redo re-applies). (`undoManager.test.ts` 4 cases; `e2e/undo-redo.spec.ts` covers button + keyboard undo/redo.)
- [x] Run `npm test`, `npm run test:e2e`, `npm run lint` — all pass before Task 6. (458 unit + 43 e2e pass; lint 0 errors.)

### Task 6: Verify acceptance criteria
- [x] Verify all Overview capabilities work end to end (panel copy+apply, MCP read+write against a fake, restore, undo/redo) and the existing owner-gated API + desktop UI are unchanged. (panel: `e2e/trip-json-panel.spec.ts` ×4; MCP: `worker/src/mcp.test.ts` `get_schema`/`read_board`/`write_board`-merges-into-2nd-doc; restore: `e2e/version-restore.spec.ts` + `trip.test.ts` round-trip; undo/redo: `e2e/undo-redo.spec.ts` + `undoManager.test.ts`; unchanged API+UI: `trip`/`index`/`auth`/`rooms` suites + all 43 desktop e2e pass.)
- [x] Verify edge cases: invalid JSON, unknown room/version id, empty board, remote agent write not on the undo stack, restore is itself reversible. (invalid: panel + MCP `isError, no mutation, no snapshot`; unknown ids: MCP + `404 unknown snapshot id`/`404 room does not exist`; empty: `empty-but-valid trip for a room with no Yjs data`; remote off-stack: `APPLY_TRIP_ORIGIN NOT on the stack`; reversible: `round-trips a real pre-write snapshot: POST then restore`.)
- [x] Run full `npm test` + `npm run test:e2e`. (458 unit + 43 e2e pass.)
- [x] Run `npm run lint` — all issues fixed. (0 errors; 3 pre-existing react-refresh warnings, unrelated.)
- [x] Run `npm run coverage` — maintain the repo's ~90% `src/data`/logic standard. (91.24% stmts / 91.9% branches; `applyTrip.ts` + `roomLink.ts` 100%; worker `tsc` clean.)

### Task 7: Update documentation
- [x] Update `CLAUDE.md` (the `/mcp` endpoint + tools, `MCP_API_KEY`, KV snapshot history + restore, the Trip-settings JSON panel, `Y.UndoManager` local undo/redo and the `applyTrip` origin). (Extended the shared-modules list with `applyTrip` origin + `roomLink`, added undo/redo to "Synced vs. per-user state", added MCP/version/snapshot bullets to "Auth / room-creation model", and a Trip-JSON-panel note in Styling.)
- [x] Update `README.md` (agent-API section: MCP connector setup + version history) and `worker/.dev.vars.example` / `worker/wrangler.toml` notes. (README Agent-API section now lists the three drive-a-board paths + version history; added `MCP_API_KEY` to the env table. `.dev.vars.example` already had `MCP_API_KEY`; added it to the `wrangler.toml` secrets header + `wrangler secret put` list. Also added a pointer in `docs/trip-schema.md`.)

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`.*

## Technical Details

**Design decisions (condensed):**
- **Why not "fetch the share link"?** The room id is in the URL **hash**, never
  sent to servers; a fetch of the app URL returns the empty SPA shell. The MCP
  tool receives the link **as a string argument**, so the hash travels fine.
- **Auth**: owner secret stays Worker-only. MCP gated by `MCP_API_KEY` (ceiling:
  that key is effectively owner-level over rooms — fine for a personal planner;
  upgrade path is to scope writes to the pasted room id as a capability). Version
  list/get are link-gated like `/api/auth`. The client panel's apply + restore are
  client-side (browser is already an authorized editor) — no secret in the client.
- **Snapshots**: Cloudflare KV, keyed by room + timestamp, **keep all** (a board
  export ~10–20 KB; 1,000 writes ≈ 10–20 MB « KV's 1 GB). Human-readable JSON.
  Restore = load old JSON through the same apply path.
- **UndoManager** is in-memory/per-session (not durable) — the durable history is
  the snapshot log. Excluding `APPLY_TRIP_ORIGIN` keeps agent/restore replaces out
  of the keystroke undo stack.

**Rejected alternatives:** tokenized read URL (panel copy + MCP read cover it);
GET-URL writes (URL length / unsafe mutation); Comet UI automation (Max-only,
brittle); Liveblocks version history (chose app-owned KV JSON for simplicity/reuse);
custom per-action diff/undo engine (reinvents `UndoManager`; over-engineering).

## Post-Completion

*Items requiring manual intervention or external systems — informational only.*

**Manual verification:**
- Real Perplexity Pro pass: add the connector (MCP URL + `MCP_API_KEY`), paste a
  board link, confirm read + write + a nudge ("use the Travel Planner connector").
- Confirm live sync (write from MCP appears in an open app tab).
- Confirm current Perplexity connector setup UX before writing user-facing docs.

**External / deploy config:**
- Provision the Cloudflare KV namespace and bind it; set `MCP_API_KEY` as a Worker
  secret (`wrangler secret put`).

**Optional extension (deferred):**
- Fold **panel-apply** writes into the durable history: before a client paste-apply,
  POST the pre-apply JSON to a link-gated `POST /api/versions/:room` record endpoint.
  Today panel-applies rely on "copy current JSON before Apply" as the manual undo;
  only Worker-mediated writes (MCP + owner POST) are auto-captured.
