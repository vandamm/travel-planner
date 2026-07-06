// POST /api/rooms — create a new Liveblocks room, gated by an owner capability token.
//
// This is the ONLY way rooms come into existence, which satisfies "nobody but me
// can create rooms": the caller presents an `owner` token (Authorization: Bearer),
// the Worker verifies it, creates the room, and returns a fresh `owner` token/link
// for the new room. That chains create-from-in-a-room: an owner link authorizes
// minting the next room's owner link. Genesis (room #0) is minted with the local CLI.

import type { Env, LiveblocksApi } from './liveblocks'
import { signToken, verifyToken } from './token'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface CreateRoomBody {
  room?: unknown
}

export async function handleCreateRoom(
  request: Request,
  env: Env,
  api: LiveblocksApi,
): Promise<Response> {
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const payload = bearer ? await verifyToken(bearer, env.TOKEN_SECRET) : null
  if (!payload || payload.p !== 'owner') {
    // Only a valid owner token may create rooms; view/edit/absent/invalid → 401.
    return json({ error: 'unauthorized' }, 401)
  }

  let body: CreateRoomBody = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text) as CreateRoomBody
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const requested = typeof body.room === 'string' ? body.room.trim() : ''
  const roomId = requested || crypto.randomUUID()

  const created = await api.createRoom(roomId)
  // Return a fresh owner token for the new room so the caller gets a shareable
  // owner link back (the token IS the link fragment).
  const token = await signToken({ r: created.id, p: 'owner', v: 1 }, env.TOKEN_SECRET)
  return json({ id: created.id, token }, 201)
}
