// Cloudflare Worker entry point: request router + CORS.
//
// Routes:
//   OPTIONS *               → CORS preflight
//   POST /api/auth          → mint a room-scoped token for an existing room
//   POST /api/rooms         → create a room (owner-gated)
//   GET  /api/schema        → JSON Schema for the trip document (owner-gated)
//   GET  /api/trip/:room    → read the room's trip as JSON (owner-gated)
//   POST /api/trip/:room    → write trip JSON into the room (owner-gated)
//   GET  /api/versions/:room       → list a room's snapshots (link-gated)
//   GET  /api/versions/:room/:id   → read one snapshot's trip JSON (link-gated)
//   POST /mcp               → MCP-over-HTTP tools endpoint (MCP_API_KEY-gated)
//
// The handlers depend on the `LiveblocksApi` abstraction; production builds the
// REST-backed implementation, while tests call `handleRequest` with a fake.

import { handleAuth } from './auth'
import { handleCreateRoom } from './rooms'
import {
  handleGetSchema,
  handleGetTrip,
  handleGetVersion,
  handleListVersions,
  handlePostTrip,
} from './trip'
import { handleMcp } from './mcp'
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

  try {
    let res: Response
    if (pathname === '/api/auth') {
      res =
        request.method === 'POST'
          ? await handleAuth(request, env, api)
          : json({ error: 'method not allowed' }, 405)
    } else if (pathname === '/api/rooms') {
      res =
        request.method === 'POST'
          ? await handleCreateRoom(request, env, api)
          : json({ error: 'method not allowed' }, 405)
    } else if (pathname === '/api/schema') {
      res =
        request.method === 'GET'
          ? await handleGetSchema(request, env)
          : json({ error: 'method not allowed' }, 405)
    } else if (pathname === '/mcp') {
      res =
        request.method === 'POST'
          ? await handleMcp(request, env, api)
          : json({ error: 'method not allowed' }, 405)
    } else if (pathname.startsWith('/api/versions/')) {
      if (request.method !== 'GET') {
        res = json({ error: 'method not allowed' }, 405)
      } else {
        let parts: string[]
        try {
          parts = pathname.slice('/api/versions/'.length).split('/').map(decodeURIComponent)
        } catch {
          return withCors(json({ error: 'invalid room id' }, 400), cors)
        }
        const roomId = parts[0]
        const versionId = parts[1]
        if (!roomId) {
          res = json({ error: 'missing room id' }, 400)
        } else if (!versionId) {
          res = await handleListVersions(env, api, roomId)
        } else {
          res = await handleGetVersion(env, api, roomId, versionId)
        }
      }
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
  } catch {
    // The Liveblocks REST layer throws on any non-2xx (outage, 429, transient
    // 5xx). Without this guard that rejection escapes `fetch` as a bare 500 with
    // no CORS headers, so the browser surfaces an opaque CORS error instead of a
    // usable status. Return a CORS'd 502 — same intent as the URIError guard above.
    return withCors(json({ error: 'upstream error' }, 502), cors)
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, createLiveblocksApi(env))
  },
}
