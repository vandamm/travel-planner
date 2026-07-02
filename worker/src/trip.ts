// Agent HTTP API — read and write a room's trip over plain JSON.
//
//   GET  /api/trip/:room  → serialize the room's Yjs doc to trip JSON
//   POST /api/trip/:room  → validate + apply trip JSON, push the change to the room
//
// Both are gated by the owner secret (`x-owner-secret`), so the agent API is as
// privileged as room creation. The serialize/apply path reuses the SAME shared
// modules the client uses (`exportTrip`, `applyTrip`, the zod schema), so what an
// agent reads and writes is identical to what the UI renders — they can't drift.
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
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Env, LiveblocksApi } from './liveblocks'
import { exportTrip } from '../../src/data/exportTrip'
import { applyTrip } from '../../src/data/applyTrip'
import { formatTripErrors, tripDocumentSchema, type TripDocument } from '../../src/data/tripSchema'
import { recordSnapshot } from './snapshots'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** The agent API is owner-only — the same gate as new-room creation. */
function ownerAuthorized(request: Request, env: Env): boolean {
  const presented = request.headers.get('x-owner-secret')
  return Boolean(env.OWNER_SECRET) && presented === env.OWNER_SECRET
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
): Promise<TripDocument> {
  const doc = await loadRoomDoc(api, roomId)
  // Record history before mutating. Skipped only if KV isn't bound.
  if (env.SNAPSHOTS) await recordSnapshot(env.SNAPSHOTS, roomId, JSON.stringify(exportTrip(doc)))
  const before = Y.encodeStateVector(doc)
  const data = applyTrip(doc, trip)
  const update = Y.encodeStateAsUpdate(doc, before)
  await api.sendYUpdate(roomId, update)
  return data
}

/**
 * Serve the JSON Schema derived from `tripDocumentSchema` — the same zod schema
 * the agent API validates against, so the published shape can never drift from
 * what POST actually accepts (no hand-written duplicate). Owner-gated like the
 * rest of the agent API.
 */
export async function handleGetSchema(request: Request, env: Env): Promise<Response> {
  if (!ownerAuthorized(request, env)) return json({ error: 'unauthorized' }, 401)
  return json(zodToJsonSchema(tripDocumentSchema), 200)
}

export async function handleGetTrip(
  request: Request,
  env: Env,
  api: LiveblocksApi,
  roomId: string,
): Promise<Response> {
  if (!ownerAuthorized(request, env)) return json({ error: 'unauthorized' }, 401)
  if (!(await api.roomExists(roomId))) return json({ error: 'room not found' }, 404)

  const doc = await loadRoomDoc(api, roomId)
  // Point at the schema endpoint so an agent reading even an empty trip learns
  // where to fetch the full shape.
  const schemaUrl = new URL('/api/schema', request.url).toString()
  return json({ $schema: schemaUrl, ...exportTrip(doc) }, 200)
}

export async function handlePostTrip(
  request: Request,
  env: Env,
  api: LiveblocksApi,
  roomId: string,
): Promise<Response> {
  if (!ownerAuthorized(request, env)) return json({ error: 'unauthorized' }, 401)
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

  const data = await applyTripToRoom(env, api, roomId, parsed.data)
  return json(data, 200)
}
