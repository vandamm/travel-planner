// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { handleAuth } from './auth'
import type { LiveblocksApi } from './liveblocks'

function makeApi(overrides: Partial<LiveblocksApi> = {}): LiveblocksApi {
  return {
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async () => 'token-123',
    getYUpdate: async () => new Uint8Array(),
    sendYUpdate: async () => {},
    ...overrides,
  }
}

function authRequest(body: unknown): Request {
  return new Request('https://worker.test/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('handleAuth', () => {
  it('mints a room-scoped token when the room already exists', async () => {
    let askedRoom: string | undefined
    const api = makeApi({
      roomExists: async (id) => {
        askedRoom = id
        return true
      },
      mintAccessToken: async (room) => `tok-for-${room}`,
    })

    const res = await handleAuth(authRequest({ room: 'paris-2026' }), api)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: 'tok-for-paris-2026' })
    expect(askedRoom).toBe('paris-2026')
  })

  it('denies a room that does not exist (creation is owner-gated)', async () => {
    let minted = false
    const api = makeApi({
      roomExists: async () => false,
      mintAccessToken: async () => {
        minted = true
        return 'should-not-happen'
      },
    })

    const res = await handleAuth(authRequest({ room: 'ghost-room' }), api)

    expect(res.status).toBe(403)
    expect(minted).toBe(false)
  })

  it('rejects a request without a room id', async () => {
    const res = await handleAuth(authRequest({}), makeApi())
    expect(res.status).toBe(400)
  })

  it('rejects a malformed JSON body', async () => {
    const bad = new Request('https://worker.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    const res = await handleAuth(bad, makeApi())
    expect(res.status).toBe(400)
  })
})
