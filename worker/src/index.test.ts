// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { handleRequest } from './index'
import type { Env, LiveblocksApi } from './liveblocks'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', OWNER_SECRET: 'owner-pw' }

function makeApi(overrides: Partial<LiveblocksApi> = {}): LiveblocksApi {
  return {
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async (room) => `tok-${room}`,
    getYUpdate: async () => new Uint8Array(),
    sendYUpdate: async () => {},
    ...overrides,
  }
}

describe('handleRequest (router + CORS)', () => {
  it('answers a CORS preflight with the allowed methods/headers', async () => {
    const req = new Request('https://worker.test/api/auth', {
      method: 'OPTIONS',
      headers: { origin: 'https://app.example' },
    })
    const res = await handleRequest(req, env, makeApi())

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'x-owner-secret',
    )
  })

  it('routes POST /api/auth to the auth handler and adds CORS headers', async () => {
    const req = new Request('https://worker.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://app.example' },
      body: JSON.stringify({ room: 'r1' }),
    })
    const res = await handleRequest(req, env, makeApi())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: 'tok-r1' })
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
  })

  it('routes POST /api/rooms through the owner gate', async () => {
    const req = new Request('https://worker.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room: 'r2' }),
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(401)
  })

  it('routes GET /api/trip/:room to the trip handler (owner-gated)', async () => {
    const req = new Request('https://worker.test/api/trip/room1', {
      method: 'GET',
      headers: { 'x-owner-secret': 'owner-pw', origin: 'https://app.example' },
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
    const body = (await res.json()) as { trip: { title: string } }
    expect(body.trip.title).toBe('')
  })

  it('rejects GET /api/trip/:room without the owner secret', async () => {
    const req = new Request('https://worker.test/api/trip/room1', { method: 'GET' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(401)
  })

  it('returns 405 for an unsupported method on /api/trip/:room', async () => {
    const req = new Request('https://worker.test/api/trip/room1', { method: 'DELETE' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(405)
  })

  it('returns 404 for an unknown route', async () => {
    const req = new Request('https://worker.test/api/nope', { method: 'POST' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(404)
  })

  it('returns 405 for a wrong method on a known route', async () => {
    const req = new Request('https://worker.test/api/auth', { method: 'GET' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(405)
  })
})
