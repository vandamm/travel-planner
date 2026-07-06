// POST /api/auth — verify a capability token and mint a Liveblocks access token
// scoped to the token's perms, but ONLY for a room that already exists. The link
// (a signed `{ roomId, perms, name }` token) is the sole credential: anyone with
// it joins at its perm level (view → read-only, edit/owner → write) without
// logging in. New rooms are created exclusively through owner-token POST /api/rooms.

import type { Env, LiveblocksApi } from './liveblocks'
import { verifyToken } from './token'
import { liveblocksAccess } from '../../src/data/token'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface AuthBody {
  token?: unknown
  userId?: unknown
}

export async function handleAuth(
  request: Request,
  env: Env,
  api: LiveblocksApi,
): Promise<Response> {
  let body: AuthBody
  try {
    body = (await request.json()) as AuthBody
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const raw = typeof body.token === 'string' ? body.token.trim() : ''
  const payload = raw ? await verifyToken(raw, env.TOKEN_SECRET) : null
  if (!payload) return json({ error: 'invalid token' }, 401)

  const room = payload.r
  if (!(await api.roomExists(room))) {
    // The room must already exist; creating one requires an owner token.
    return json({ error: 'room not found' }, 403)
  }

  // Identify the session; the token is the credential, so a stable per-session
  // id is sufficient (no login).
  const userId = typeof body.userId === 'string' && body.userId ? body.userId : `guest-${room}`
  const token = await api.mintAccessToken(room, userId, {
    access: liveblocksAccess(payload.p),
    name: payload.n,
  })
  return json({ token }, 200)
}
