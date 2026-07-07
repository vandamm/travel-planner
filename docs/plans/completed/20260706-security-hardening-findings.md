# Security hardening — findings from the 2026-07-06 architecture review

Status: Complete.

## Overview

Address three of the accepted findings from the architecture/security review
(threat model: family-only, publicly reachable, secret-by-link). Token expiry
(`exp` + mint `--ttl`) is deferred to a later plan (see Post-Completion).

1. **Token-gate the version-history endpoints.** `GET /api/versions/:room[/:id]`
   currently verifies no token — knowing the room id alone yields the entire
   trip history, and it survives `TOKEN_SECRET` rotation (the app's only
   revocation lever). Require a `view`+ capability token, room-matched, like
   `/api/trip`. Rotation then revokes **everything**.
2. **Prune dangling city refs in `exportTrip`.** A concurrent remove-city +
   add-referencing-it merge can leave a `cityId` that no city matches; today
   `exportTrip` throws and the board becomes "unserializable" until a human
   repairs it. Prune instead (mirror `removeCity`'s cascade semantics), so the
   known CRDT-merge artifact self-heals at export.
3. **Guard `exportTrip` in `GET /api/trip/:room`.** The one export consumer
   without a guard: an unserializable doc currently escapes as the router's
   generic 502 "upstream error" (reads as a Liveblocks outage). Catch it and
   return a clear 409, aligned with MCP `read_board`'s friendly error. (After
   item 2 the remaining trigger is another merge artifact — e.g. an inverted
   day window from two concurrent, individually-valid single-field edits.)

## Context (from discovery)

- **Files involved:**
  - `worker/src/trip.ts` — `handleListVersions` / `handleGetVersion` (add
    `tokenAuthorized`, they don't take `request` today), `handleGetTrip`
    (guard `exportTrip`), existing `tokenAuthorized` helper to reuse.
  - `worker/src/index.ts` — pass `request` to the version handlers.
  - `src/data/RoomProvider.tsx` — expose the raw `token` on `RoomContextValue`
    (TripModal needs it for the Authorization header; the provider already holds it).
  - `src/features/trip/TripModal.tsx` — send `Authorization: Bearer <token>` on
    the two version fetches.
  - `src/data/exportTrip.ts` — prune dangling refs before the final schema parse.
- **Related patterns found:**
  - `tokenAuthorized(request, env, roomId, minPerm)` in `worker/src/trip.ts`
    is exactly the gate the version endpoints need; trip handlers order it
    auth-first (401), then room existence (404) — mirror that.
  - Worker tests use the `LiveblocksApi` fake; sync-affecting states are built
    with two-`Y.Doc` merge tests, not mocks.
  - e2e mocks the version endpoints with `page.route('**/api/versions/**')`
    (`e2e/version-restore.spec.ts`) — extend the mock to assert the header.
  - Existing guards for an unserializable doc (MCP `read_board`, `TripModal`,
    snapshot-skip in `applyTripToRoom`) stay as defense in depth.
- **Dependencies:** none new.
- **Breaking change (accepted):** an already-deployed SPA fetches versions
  without the header and gets 401 until Pages is redeployed — deploy Worker and
  Pages together (see Post-Completion). All existing links stay valid.

## Development Approach

- **Testing approach**: TDD (red-green) per CLAUDE.md — failing test first, then
  implement to green, for every task.
- Complete each task fully before moving to the next; small, focused changes.
- **CRITICAL: every task MUST include new/updated tests** (success + error
  scenarios); tests are separate checklist items, not bundled with implementation.
- **CRITICAL: all tests must pass before starting the next task** — no exceptions.
- **CRITICAL: update this plan file when scope changes during implementation.**
- Keep the shared `src/data/` modules environment-agnostic (no browser/Worker-only
  APIs); token verification stays Worker-only.

## Testing Strategy

- **Unit (Vitest):** `exportTrip` pruning (dangling accommodation `cityId`,
  dangling `dayOverrides` entry, valid refs untouched, round-trip after prune).
- **Worker unit (LiveblocksApi fake):** version endpoints — `view`/`edit`/`owner`
  token lists and gets; absent/invalid/wrong-room token → 401; unknown room →
  404 (with a valid token); `GET /api/trip` on an unserializable doc → 409 with
  a legible message (built via a real two-`Y.Doc` merge, per repo convention).
- **E2E (Playwright, offline):** `version-restore.spec.ts` keeps passing with
  the Authorization header asserted in the route mock.

## Progress Tracking

- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with ➕ prefix; blockers with ⚠️ prefix.
- Keep this plan in sync with actual work.

## What Goes Where

- **Implementation Steps** (`[ ]`): code + tests + doc edits in this repo.
- **Post-Completion** (no checkboxes): deploys, live smoke tests, and the
  deferred expiry work.

## Implementation Steps

### Task 1: token-gate `/api/versions/:room[/:id]` (view+, room-matched)
- [x] `worker/src/trip.ts`: `handleListVersions` / `handleGetVersion` take the
      `request` and require `tokenAuthorized(request, env, roomId, 'view')` →
      401 before the room-existence check (mirror `handleGetTrip`'s order).
      Update their doc comments: these are no longer room-id-gated, and
      `TOKEN_SECRET` rotation now revokes history access too.
- [x] `worker/src/index.ts`: pass `request` through to both handlers; update the
      route-table comment (`link-gated` → `view+ token, room-matched`).
- [x] `src/data/RoomProvider.tsx`: add the raw `token: string | null` to
      `RoomContextValue` (the provider already derives it).
- [x] `src/features/trip/TripModal.tsx`: send `Authorization: Bearer <token>`
      on `loadVersions` and `restoreVersion`; update the panel's stale
      "link-gated / no secret here" comment.
- [x] write worker tests (`worker/src/trip.test.ts` + routing in
      `index.test.ts`): list + get succeed with `view`, `edit`, and `owner`
      tokens for the room; absent, invalid, and **wrong-room** tokens → 401;
      valid token + unknown room → 404; valid token + unbound KV → empty list.
- [x] update `e2e/version-restore.spec.ts`: assert the mocked
      `**/api/versions/**` requests carry an `Authorization: Bearer` header
      (the e2e link's unsigned token — the mock only checks presence).
- [x] update the client test for the new context field
      (`src/data/RoomProvider.test.tsx`: token exposed; null without a hash).
- [x] run `npm test` + `npm run test:e2e` — must pass before Task 2.

### Task 2: `exportTrip` prunes dangling city refs (self-heal the merge artifact)
- [x] `src/data/exportTrip.ts`: before the final `tripDocumentSchema.parse`,
      compute the exported city-id set and (a) drop `cityId` from any
      accommodation whose city is missing (keep the accommodation), (b) drop any
      `dayOverrides` entry pointing at a missing city — the same cascade
      semantics `removeCity` applies at delete time. Keep the final parse as the
      backstop for anything else.
- [x] keep the existing consumer guards (MCP `read_board`, `TripModal`,
      snapshot-skip) untouched — they still cover the residual failure modes.
- [x] write tests (`src/data/exportTrip.test.ts`): a doc with a dangling
      accommodation `cityId` (seed the dangling state via a two-doc merge of
      remove-city and add-referencing-it, per repo convention) exports with the
      `cityId` dropped and the accommodation kept; a dangling override entry is
      dropped; valid references are untouched; the pruned export round-trips
      through `applyTrip`.
- [x] run `npm test` — must pass before Task 3.

### Task 3: guard `exportTrip` in `GET /api/trip/:room`
- [x] `worker/src/trip.ts` `handleGetTrip`: wrap the `exportTrip(doc)` call in
      try/catch; on throw return **409** with a legible message (reuse the MCP
      `read_board` wording: the board is in an inconsistent state — use
      `write_board`/`POST` to replace it with a valid document) instead of
      falling through to the router's generic 502.
- [x] write a worker test: build the inconsistent doc via a two-`Y.Doc` merge of
      two individually-valid `setTrip` window edits (A: `dayStart` 20:00 against
      end 21:00; B: `dayEnd` 07:00 against start 06:00 → merged window inverted),
      push it through the fake, assert `GET /api/trip/:room` → 409 with the
      message (not 502); assert a healthy doc still returns 200.
- [x] run `npm test` — must pass before Task 4.

### Task 4: Verify acceptance criteria
- [x] verify all three Overview items behave end to end against the fakes:
      rotation-revocable versions (401 without token), dangling-ref board
      exports cleanly, inconsistent board reads as 409 on HTTP and a tool error
      on MCP.
- [x] verify edge cases: wrong-room token on versions; pruned export
      re-imports; empty board still exports.
- [x] run full `npm test` and `npm run test:e2e`.
- [x] run `npm run lint` — all issues fixed (the 3 pre-existing react-refresh
      warnings are known and out of scope).
- [x] run `npm run coverage` — maintain the repo's ~90% `src/data`/logic standard;
      `npx tsc --noEmit` (root and `worker/`) clean.

### Task 5: Update documentation
- [x] `CLAUDE.md` "Auth / room-creation model": version endpoints are now
      token-gated (`view`+, room-matched); rotating `TOKEN_SECRET` now revokes
      **all** access including history.
- [x] `README.md`: env table `TOKEN_SECRET` note (rotation caveat is gone),
      Agent API / version-history section (token-gated).
- [x] `docs/deployment.md`: rotation prerequisite note.
- [x] `docs/trip-schema.md`: version-endpoints auth description.
- [x] `worker/wrangler.toml`: secrets comment block (rotation now total).

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`.*

## Technical Details

- **Version-endpoint auth** reuses `tokenAuthorized` (verify + `r === roomId` +
  `permAtLeast(p, 'view')`). Order: 401 (auth) before 404 (room), matching the
  trip handlers. Restore itself still applies client-side through the
  perm-scoped Liveblocks connection, so a `view` holder can list/read history
  but still cannot write it back.
- **Pruning semantics** in `exportTrip` mirror `removeCity`'s cascade: an
  accommodation survives without its `cityId`; an override entry is deleted.
  Deterministic output ordering is unaffected. The final schema parse remains —
  export must still never emit an invalid document.
- **409 choice** for the unserializable GET: the request is fine, the resource
  state conflicts with its schema; 502 (current behavior) misattributes it to
  Liveblocks. MCP keeps its tool-error shape.

## Post-Completion

*Items requiring manual intervention or external systems — informational only.*

**Deploy (order matters):**
- Deploy the Worker (`npm run deploy:worker:prod`), then trigger the Pages
  build. Between the two, an already-open SPA's "Recent versions" fetch gets a
  401 (shows the panel's error state) — harmless, resolves on the Pages deploy.
- No secret changes; existing links keep working.

**Manual verification:**
- Live: open the board with the family link → versions list loads; `curl` the
  version endpoints with no token → 401 (previously 200).

**Deferred to a later plan:**
- **Token expiry** — optional `exp` (unix seconds) in the payload, enforced in
  `verifyToken` only, plus a mint-CLI `--ttl` flag. Opt-in per link at mint
  time so family links stay permanent; intended for short-lived edit links
  pasted into AI tools. No client expiry UX.
- Client "this link has expired" screen (depends on the above).
- Rate limiting, per-link revocation store, E2E encryption — out of threat model.

**Deliberately out of scope (revisit only if felt in practice):**
- Window-inversion normalization at export (the 409 guard covers it).
