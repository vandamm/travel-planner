// Agent HTTP API — read and write a room's trip over plain JSON.
//
//   GET  /api/trip/:room  → serialize the room's Yjs doc to trip JSON
//   POST /api/trip/:room  → validate + apply trip JSON, push the change to the room
//
// Routes are gated by Cloudflare Access before these handlers run. The serialize/apply path
// reuses the SAME shared modules the client uses (`exportTrip`, `applyTrip`, the
// zod schema), so what an agent reads and writes is identical to what the UI
// renders — they can't drift.
//
// Writes are a snapshot-relative full replace: we load the room's current Yjs
// state, capture its state vector, apply the new trip (clear + rebuild), then
// send only the diff (additions *and* deletions) back to Liveblocks, which
// merges it into the live document so connected clients converge in real time.
//
// ponytail: this is a stateless REST read-modify-write, so it is NOT atomic
// against live editors. An entity a client creates *after* our snapshot is
// invisible to our delete set — Yjs can only delete items it has observed — so
// it survives the merge: the result is "our payload plus anything added during
// the window", not strictly our payload. The agent API is owner-gated and
// low-concurrency, so we accept that; closing the window would need a
// server-side compare-and-swap the Liveblocks ydoc PUT doesn't expose (or the
// Worker joining as a live Yjs client), both far past what this API needs.

import * as Y from 'yjs'
import { ZodError } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Env, LiveblocksApi } from './liveblocks'
import { exportTrip } from '../../src/data/exportTrip'
import { applyTrip } from '../../src/data/applyTrip'
import { formatTripErrors, tripDocumentSchema, type TripDocument } from '../../src/data/tripSchema'
import { getSnapshot, listSnapshots, recordSnapshot } from './snapshots'
import { isValidSlug } from '../../src/data/slug'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Reconstruct the room's current `Y.Doc` from its binary Liveblocks state. */
export async function loadRoomDoc(api: LiveblocksApi, roomId: string): Promise<Y.Doc> {
  const doc = new Y.Doc()
  const update = await api.getYUpdate(roomId)
  if (update.byteLength > 0) Y.applyUpdate(doc, update)
  return doc
}

/**
 * The shared write path for both Worker-mediated writers (owner `POST` and the
 * MCP `write_board` tool): load the room, **snapshot its current trip first**
 * (so any write is revertible), then full-replace with `trip` and push the diff
 * — additions *and* deletions — back to Liveblocks. The caller validates `trip`
 * against the schema before calling, so a bad payload never reaches here.
 */
export async function applyTripToRoom(
  env: Env,
  api: LiveblocksApi,
  roomId: string,
  trip: TripDocument,
): Promise<{ data: TripDocument; snapshotted: boolean }> {
  const doc = await loadRoomDoc(api, roomId)
  // Record history before mutating — best-effort. Skipped if KV isn't bound, if
  // the current state can't be serialized (`exportTrip` re-validates and throws
  // on an inconsistent doc — e.g. concurrent day-window edits that merge into
  // dayEnd <= dayStart), or if the KV write itself errors
  // (transient outage/rate-limit). A board that drifted into any of those states
  // must stay writable — otherwise `write_board`, the very tool used to repair
  // it, would 502 (and only in prod, where KV is bound). We report whether a
  // snapshot was actually taken so callers don't promise a rollback point that
  // doesn't exist.
  let snapshotted = false
  if (env.SNAPSHOTS) {
    try {
      await recordSnapshot(env.SNAPSHOTS, roomId, JSON.stringify(exportTrip(doc)))
      snapshotted = true
    } catch {
      snapshotted = false
    }
  }
  const before = Y.encodeStateVector(doc)
  const data = applyTrip(doc, trip)
  const update = Y.encodeStateAsUpdate(doc, before)
  await api.sendYUpdate(roomId, update)
  return { data, snapshotted }
}

/**
 * Serve the JSON Schema derived from `tripDocumentSchema` — the same zod schema
 * the agent API validates against, so the published shape can never drift from
 * what POST actually accepts (no hand-written duplicate). Public: the schema is
 * the API's shape, not a secret, so no token is required to read it.
 */
export async function handleGetSchema(): Promise<Response> {
  return json(zodToJsonSchema(tripDocumentSchema), 200)
}

export async function handleGetTrip(
  request: Request,
  _env: Env,
  api: LiveblocksApi,
  roomId: string,
): Promise<Response> {
  if (!isValidSlug(roomId)) return json({ error: 'invalid room' }, 400)
  if (!(await api.roomExists(roomId))) return json({ error: 'room not found' }, 404)

  const doc = await loadRoomDoc(api, roomId)
  // Point at the schema endpoint so an agent reading even an empty trip learns
  // where to fetch the full shape.
  const schemaUrl = new URL('/api/schema', request.url).toString()
  try {
    return json({ $schema: schemaUrl, ...exportTrip(doc) }, 200)
  } catch (error) {
    if (!(error instanceof ZodError)) throw error
    return json(
      {
        error:
          'The board could not be read as a valid trip - it is in an inconsistent state. ' +
          'Use write_board or POST /api/trip/:room to replace it with a valid trip document.',
      },
      409,
    )
  }
}

/**
 * Version history is behind Cloudflare Access. Unknown room → 404 after auth.
 * When KV isn't bound there's simply no history: list is empty.
 */
export async function handleListVersions(
  request: Request,
  env: Env,
  api: LiveblocksApi,
  roomId: string,
): Promise<Response> {
  void request
  if (!isValidSlug(roomId)) return json({ error: 'invalid room' }, 400)
  if (!(await api.roomExists(roomId))) return json({ error: 'room not found' }, 404)
  const versions = env.SNAPSHOTS ? await listSnapshots(env.SNAPSHOTS, roomId) : []
  return json({ versions }, 200)
}

/**
 * Return a single snapshot's trip JSON verbatim (it is already a trip document).
 * Requires the same Cloudflare Access gate as snapshot listing.
 */
export async function handleGetVersion(
  request: Request,
  env: Env,
  api: LiveblocksApi,
  roomId: string,
  id: string,
): Promise<Response> {
  void request
  if (!isValidSlug(roomId)) return json({ error: 'invalid room' }, 400)
  if (!(await api.roomExists(roomId))) return json({ error: 'room not found' }, 404)
  const snapshot = env.SNAPSHOTS ? await getSnapshot(env.SNAPSHOTS, roomId, id) : null
  if (snapshot === null) return json({ error: 'version not found' }, 404)
  return new Response(snapshot, { status: 200, headers: { 'content-type': 'application/json' } })
}

export async function handlePostTrip(
  request: Request,
  env: Env,
  api: LiveblocksApi,
  roomId: string,
): Promise<Response> {
  if (!isValidSlug(roomId)) return json({ error: 'invalid room' }, 400)
  if (!(await api.roomExists(roomId))) return json({ error: 'room not found' }, 404)

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  // Validate before touching the room so a bad payload is a clean 400 and never
  // mutates the doc (nor records a snapshot); `formatTripErrors` makes the
  // failure legible to the agent.
  const parsed = tripDocumentSchema.safeParse(input)
  if (!parsed.success) return json({ error: formatTripErrors(parsed.error) }, 400)

  const { data } = await applyTripToRoom(env, api, roomId, parsed.data)
  return json(data, 200)
}
