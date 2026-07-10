// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handleCreateRoom } from './rooms'
import type { Env, LiveblocksApi } from './liveblocks'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', DEV_AUTH_EMAIL: 'me@example.com' }

function makeApi(overrides: Partial<LiveblocksApi> = {}): { api: LiveblocksApi; created: string[] } {
  const created: string[] = []
  return {
    created,
    api: {
      roomExists: async () => false,
      createRoom: async (id) => {
        created.push(id)
        return { id }
      },
      mintAccessToken: async () => 'token-123',
      getYUpdate: async () => new Uint8Array(),
      sendYUpdate: async () => {},
      ...overrides,
    },
  }
}

function roomRequest(body: unknown): Request {
  return new Request('https://worker.test/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('handleCreateRoom', () => {
  it('creates a slug room and returns its id', async () => {
    const { api, created } = makeApi()
    const res = await handleCreateRoom(roomRequest({ room: 'rome-2027' }), env, api)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'rome-2027' })
    expect(created).toEqual(['rome-2027'])
  })

  it('rejects invalid slugs', async () => {
    const { api, created } = makeApi()
    const res = await handleCreateRoom(roomRequest({ room: 'Rome_2027' }), env, api)
    expect(res.status).toBe(400)
    expect(created).toEqual([])
  })

  it('rejects duplicate rooms', async () => {
    const { api, created } = makeApi({ roomExists: async () => true })
    const res = await handleCreateRoom(roomRequest({ room: 'rome-2027' }), env, api)
    expect(res.status).toBe(409)
    expect(created).toEqual([])
  })

  it('rejects malformed JSON', async () => {
    const { api } = makeApi()
    const res = await handleCreateRoom(roomRequest('not json'), env, api)
    expect(res.status).toBe(400)
  })
})
