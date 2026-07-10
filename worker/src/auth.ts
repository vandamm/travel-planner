// POST /api/auth — mint a Liveblocks access token for an Access-authenticated
// user, scoped to an existing slug room.

import type { Env, LiveblocksApi } from './liveblocks'
import type { AccessIdentity } from './access'
import { isValidSlug } from '../../src/data/slug'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface AuthBody {
  room?: unknown
}

export async function handleAuth(
  request: Request,
  env: Env,
  api: LiveblocksApi,
  identity: AccessIdentity,
): Promise<Response> {
  let body: AuthBody
  try {
    body = (await request.json()) as AuthBody
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const room = typeof body.room === 'string' ? body.room.trim() : ''
  if (!isValidSlug(room)) return json({ error: 'invalid room' }, 400)
  if (!(await api.roomExists(room))) {
    return json({ error: 'room not found' }, 403)
  }

  const token = await api.mintAccessToken(room, identity.email, {
    access: 'room:write',
    name: identity.email,
  })
  return json({ token }, 200)
}
