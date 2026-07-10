// POST /api/rooms — create a new slug-named Liveblocks room. Cloudflare Access
// gates the route before this handler runs.

import type { Env, LiveblocksApi } from './liveblocks'
import { isValidSlug } from '../../src/data/slug'

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
  _env: Env,
  api: LiveblocksApi,
): Promise<Response> {
  let body: CreateRoomBody = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text) as CreateRoomBody
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const requested = typeof body.room === 'string' ? body.room.trim() : ''
  if (!isValidSlug(requested)) return json({ error: 'invalid room' }, 400)
  const roomId = requested

  if (await api.roomExists(roomId)) {
    return json({ error: 'room already exists' }, 409)
  }

  const created = await api.createRoom(roomId)
  return json({ id: created.id }, 201)
}
