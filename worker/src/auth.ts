// POST /api/auth — mint a room-scoped Liveblocks access token, but ONLY for a
// room that already exists. New rooms are created exclusively through the
// owner-gated POST /api/rooms, so anyone with the secret link can join and edit
// an existing room without logging in, yet nobody can conjure new rooms here.

import type { LiveblocksApi } from './liveblocks'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface AuthBody {
  room?: unknown
  userId?: unknown
}

export async function handleAuth(request: Request, api: LiveblocksApi): Promise<Response> {
  let body: AuthBody
  try {
    body = (await request.json()) as AuthBody
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const room = typeof body.room === 'string' ? body.room.trim() : ''
  if (!room) return json({ error: 'missing room id' }, 400)

  if (!(await api.roomExists(room))) {
    // The room must already exist; creating one requires the owner secret.
    return json({ error: 'room not found' }, 403)
  }

  // Identify the session; the secret link is the credential, so a stable
  // per-session id is sufficient (no login).
  const userId = typeof body.userId === 'string' && body.userId ? body.userId : `guest-${room}`
  const token = await api.mintAccessToken(room, userId)
  return json({ token }, 200)
}
