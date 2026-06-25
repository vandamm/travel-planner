// POST /api/rooms — create a new Liveblocks room, gated by the owner secret.
//
// This is the ONLY way rooms come into existence, which satisfies "nobody but
// me can create rooms": the owner presents `x-owner-secret`, the Worker creates
// the room, and from then on anyone with the room's secret link can join via
// POST /api/auth without logging in.

import type { Env, LiveblocksApi } from './liveblocks'

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
  const presented = request.headers.get('x-owner-secret')
  if (!env.OWNER_SECRET || presented !== env.OWNER_SECRET) {
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
  return json({ id: created.id }, 201)
}
