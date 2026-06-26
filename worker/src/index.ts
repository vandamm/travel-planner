// Cloudflare Worker entry point: request router + CORS.
//
// Routes:
//   OPTIONS *               → CORS preflight
//   POST /api/auth          → mint a room-scoped token for an existing room
//   POST /api/rooms         → create a room (owner-gated)
//   GET  /api/trip/:room    → read the room's trip as JSON (owner-gated)
//   POST /api/trip/:room    → write trip JSON into the room (owner-gated)
//
// The handlers depend on the `LiveblocksApi` abstraction; production builds the
// REST-backed implementation, while tests call `handleRequest` with a fake.

import { handleAuth } from './auth'
import { handleCreateRoom } from './rooms'
import { handleGetTrip, handlePostTrip } from './trip'
import { createLiveblocksApi, type Env, type LiveblocksApi } from './liveblocks'

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = env.ALLOWED_ORIGIN ?? request.headers.get('origin') ?? '*'
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-owner-secret',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

/** Return a copy of `res` with the CORS headers merged in. */
function withCors(res: Response, headers: Record<string, string>): Response {
  const merged = new Headers(res.headers)
  for (const [key, value] of Object.entries(headers)) merged.set(key, value)
  return new Response(res.body, { status: res.status, headers: merged })
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function handleRequest(
  request: Request,
  env: Env,
  api: LiveblocksApi,
): Promise<Response> {
  const cors = corsHeaders(request, env)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const { pathname } = new URL(request.url)

  let res: Response
  if (pathname === '/api/auth') {
    res =
      request.method === 'POST'
        ? await handleAuth(request, api)
        : json({ error: 'method not allowed' }, 405)
  } else if (pathname === '/api/rooms') {
    res =
      request.method === 'POST'
        ? await handleCreateRoom(request, env, api)
        : json({ error: 'method not allowed' }, 405)
  } else if (pathname.startsWith('/api/trip/')) {
    let roomId: string
    try {
      // A malformed percent-escape (e.g. invalid UTF-8 like '%C0') makes
      // decodeURIComponent throw a URIError; answer 400 rather than letting it
      // escape the handler as a CORS-less 500.
      roomId = decodeURIComponent(pathname.slice('/api/trip/'.length))
    } catch {
      return withCors(json({ error: 'invalid room id' }, 400), cors)
    }
    if (!roomId) {
      res = json({ error: 'missing room id' }, 400)
    } else if (request.method === 'GET') {
      res = await handleGetTrip(request, env, api, roomId)
    } else if (request.method === 'POST') {
      res = await handlePostTrip(request, env, api, roomId)
    } else {
      res = json({ error: 'method not allowed' }, 405)
    }
  } else {
    res = json({ error: 'not found' }, 404)
  }

  return withCors(res, cors)
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, createLiveblocksApi(env))
  },
}
