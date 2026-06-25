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
// Writes are CRDT-correct: we load the room's current Yjs state, capture its
// state vector, apply the new trip as a full replace, then send only the diff
// update (additions *and* deletions) back to Liveblocks, which merges it into the
// live document so connected clients converge in real time.

import * as Y from 'yjs'
import type { Env, LiveblocksApi } from './liveblocks'
import { exportTrip } from '../../src/data/exportTrip'
import { applyTrip } from '../../src/data/applyTrip'
import { formatTripErrors, tripDocumentSchema } from '../../src/data/tripSchema'

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
async function loadRoomDoc(api: LiveblocksApi, roomId: string): Promise<Y.Doc> {
  const doc = new Y.Doc()
  const update = await api.getYUpdate(roomId)
  if (update.byteLength > 0) Y.applyUpdate(doc, update)
  return doc
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
  return json(exportTrip(doc), 200)
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
  // mutates the doc; `formatTripErrors` makes the failure legible to the agent.
  const parsed = tripDocumentSchema.safeParse(input)
  if (!parsed.success) return json({ error: formatTripErrors(parsed.error) }, 400)

  const doc = await loadRoomDoc(api, roomId)
  const before = Y.encodeStateVector(doc)
  const data = applyTrip(doc, parsed.data)
  // Diff against the pre-apply state vector so the update carries the deletions
  // from the full-replace too, not just the new entities.
  const update = Y.encodeStateAsUpdate(doc, before)
  await api.sendYUpdate(roomId, update)

  return json(data, 200)
}
