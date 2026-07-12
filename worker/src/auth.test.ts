// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handleAuth } from './auth'
import type { AccessIdentity } from './access'
import type { Env, LiveblocksApi } from './liveblocks'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', DEV_AUTH_EMAIL: 'me@example.com' }
const identity: AccessIdentity = { email: 'me@example.com' }

interface MintCall {
  roomId: string
  userId: string
  opts: { access: 'room:read' | 'room:write'; name?: string }
}

function makeApi(overrides: Partial<LiveblocksApi> = {}): {
  api: LiveblocksApi
  mints: MintCall[]
} {
  const mints: MintCall[] = []
  return {
    mints,
    api: {
      listRooms: async () => ({ rooms: [], nextCursor: null }),
      roomExists: async () => true,
      createRoom: async (id) => ({ id }),
      mintAccessToken: async (roomId, userId, opts) => {
        mints.push({ roomId, userId, opts })
        return `tok-for-${roomId}`
      },
      getYUpdate: async () => new Uint8Array(),
      sendYUpdate: async () => {},
      ...overrides,
    },
  }
}

function authRequest(body: unknown): Request {
  return new Request('https://worker.test/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('handleAuth', () => {
  it('mints a room:write Liveblocks token for an existing slug room', async () => {
    const { api, mints } = makeApi()
    const res = await handleAuth(authRequest({ room: 'paris-2026' }), env, api, identity)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: 'tok-for-paris-2026' })
    expect(mints).toEqual([
      {
        roomId: 'paris-2026',
        userId: 'me@example.com',
        opts: { access: 'room:write', name: 'me@example.com' },
      },
    ])
  })

  it('rejects invalid room slugs', async () => {
    const { api, mints } = makeApi()
    const res = await handleAuth(authRequest({ room: 'Paris_2026' }), env, api, identity)
    expect(res.status).toBe(400)
    expect(mints).toHaveLength(0)
  })

  it('denies a room that does not exist', async () => {
    const { api, mints } = makeApi({ roomExists: async () => false })
    const res = await handleAuth(authRequest({ room: 'ghost' }), env, api, identity)
    expect(res.status).toBe(403)
    expect(mints).toHaveLength(0)
  })

  it('rejects malformed JSON', async () => {
    const { api } = makeApi()
    const res = await handleAuth(authRequest('not json'), env, api, identity)
    expect(res.status).toBe(400)
  })
})
