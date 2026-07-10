// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { handleMcp } from './mcp'
import type { Env, LiveblocksApi } from './liveblocks'
import { addCard, addCity, setTrip } from '../../src/data/doc'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', DEV_AUTH_EMAIL: 'me@example.com' }

type TestApi = LiveblocksApi & { sentCount(): number }

function makeApi(seed?: Y.Doc, overrides: Partial<LiveblocksApi> = {}): TestApi {
  let state: Uint8Array = seed ? Y.encodeStateAsUpdate(seed) : new Uint8Array()
  let sent = 0
  return {
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async (room) => `tok-${room}`,
    getYUpdate: async () => state,
    sendYUpdate: async (_room, update) => {
      sent += 1
      const doc = new Y.Doc()
      if (state.byteLength > 0) Y.applyUpdate(doc, state)
      Y.applyUpdate(doc, update)
      state = Y.encodeStateAsUpdate(doc)
    },
    sentCount: () => sent,
    ...overrides,
  }
}

function seededDoc(): Y.Doc {
  const doc = new Y.Doc()
  setTrip(doc, { title: 'Seed Trip', startDate: '2027-01-01', numDays: 2 })
  addCity(doc, { id: 'c1', name: 'Paris', color: '#0000ff' })
  addCard(doc, { id: 'k1', dayKey: '2027-01-01', title: 'Louvre' })
  return doc
}

function request(payload: unknown): Request {
  return new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

async function rpc(api: LiveblocksApi, method: string, params?: unknown) {
  const res = await handleMcp(request({ jsonrpc: '2.0', id: 1, method, params }), env, api)
  return (await res.json()) as { result?: unknown; error?: unknown }
}

const validTrip = {
  trip: { title: 'Italy', startDate: '2027-05-01', numDays: 3, dayStart: '06:00', dayEnd: '21:00' },
  cities: [{ id: 'c2', name: 'Rome', color: '#ff0000' }],
  accommodations: [],
  cards: [{ id: 'k2', dayKey: '2027-05-01', title: 'Colosseum', order: 0 }],
  dayOverrides: {},
}

describe('handleMcp', () => {
  it('handles initialize and advertises slug-based tools', async () => {
    const init = await rpc(makeApi(), 'initialize')
    expect(init.result).toMatchObject({ capabilities: { tools: {} } })

    const tools = await rpc(makeApi(), 'tools/list')
    expect(JSON.stringify(tools.result)).toContain('"slug"')
    expect(JSON.stringify(tools.result)).not.toContain('"link"')
  })

  it('returns the schema', async () => {
    const body = await rpc(makeApi(), 'tools/call', { name: 'get_schema', arguments: {} })
    expect(JSON.stringify(body.result)).toContain('trip')
  })

  it('reads a board by slug', async () => {
    const body = await rpc(makeApi(seededDoc()), 'tools/call', {
      name: 'read_board',
      arguments: { slug: 'room1' },
    })
    expect(JSON.stringify(body.result)).toContain('Seed Trip')
  })

  it('writes a board by slug', async () => {
    const api = makeApi(seededDoc())
    const body = await rpc(api, 'tools/call', {
      name: 'write_board',
      arguments: { slug: 'room1', trip: validTrip },
    })
    expect(JSON.stringify(body.result)).toContain('Board updated')
    expect(api.sentCount()).toBe(1)
  })

  it('returns tool errors for invalid slugs, missing rooms, and invalid trips', async () => {
    const invalidSlug = await rpc(makeApi(), 'tools/call', {
      name: 'read_board',
      arguments: { slug: 'Bad_room' },
    })
    expect(JSON.stringify(invalidSlug.result)).toContain('isError')

    const missing = await rpc(makeApi(undefined, { roomExists: async () => false }), 'tools/call', {
      name: 'read_board',
      arguments: { slug: 'room1' },
    })
    expect(JSON.stringify(missing.result)).toContain('No board found')

    const badTrip = await rpc(makeApi(), 'tools/call', {
      name: 'write_board',
      arguments: { slug: 'room1', trip: { nope: true } },
    })
    expect(JSON.stringify(badTrip.result)).toContain('invalid')
  })
})
