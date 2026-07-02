// @vitest-environment node
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { handleMcp } from './mcp'
import type { Env, LiveblocksApi } from './liveblocks'
import type { SnapshotKv } from './snapshots'
import { addCard, addCity, setTrip } from '../../src/data/doc'
import { exportTrip } from '../../src/data/exportTrip'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', OWNER_SECRET: 'owner-pw', MCP_API_KEY: 'mcp-key' }

type TestApi = LiveblocksApi & { sentCount(): number; lastUpdate(): Uint8Array | null }

/**
 * In-memory Liveblocks fake that merges sent updates back into its state (so a
 * read after a write reflects it) and records the last update + send count.
 */
function makeApi(seed?: Y.Doc, overrides: Partial<LiveblocksApi> = {}): TestApi {
  let state: Uint8Array = seed ? Y.encodeStateAsUpdate(seed) : new Uint8Array()
  let sent = 0
  let last: Uint8Array | null = null
  return {
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async (room) => `tok-${room}`,
    getYUpdate: async () => state,
    sendYUpdate: async (_room, update) => {
      sent += 1
      last = update
      const doc = new Y.Doc()
      if (state.byteLength > 0) Y.applyUpdate(doc, state)
      Y.applyUpdate(doc, update)
      state = Y.encodeStateAsUpdate(doc)
    },
    sentCount: () => sent,
    lastUpdate: () => last,
    ...overrides,
  }
}

/** In-memory KV fake — the small slice `snapshots.ts` uses. */
function makeKv(): SnapshotKv & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value)
    },
    list: async ({ prefix }) => ({
      keys: [...store.keys()].filter((n) => n.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  }
}

function seededDoc(): Y.Doc {
  const doc = new Y.Doc()
  setTrip(doc, { title: 'Seed Trip', startDate: '2027-01-01', numDays: 2 })
  addCity(doc, { id: 'c1', name: 'Paris', color: '#0000ff' })
  addCard(doc, { id: 'k1', dayKey: '2027-01-01', title: 'Louvre' })
  return doc
}

// `null` = send no Authorization header (explicit `undefined` would just trigger
// the default value). Any string is sent verbatim as the bearer token.
function mcpRequest(payload: unknown, apiKey: string | null = 'mcp-key'): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey !== null) headers['authorization'] = `Bearer ${apiKey}`
  return new Request('https://worker.test/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
}

type RpcResponse = { result?: unknown; error?: { code: number; message: string } }
type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean }

describe('handleMcp — handshake', () => {
  it('responds to initialize with capabilities + serverInfo and the version it supports', async () => {
    // Client asks for a version the server does not implement; the server must
    // still answer with its own supported version, not echo the request back.
    const res = await handleMcp(
      mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }),
      env,
      makeApi(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as RpcResponse
    const result = body.result as {
      protocolVersion: string
      capabilities: { tools?: unknown }
      serverInfo: { name: string }
    }
    expect(result.protocolVersion).toBe('2025-06-18')
    expect(result.capabilities.tools).toBeDefined()
    expect(result.serverInfo.name).toBe('travel-planner')
  })

  it('acks ping with an empty result', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', id: 7, method: 'ping' }), env, makeApi())
    expect(res.status).toBe(200)
    expect(((await res.json()) as RpcResponse).result).toEqual({})
  })

  it('returns a parse error (-32700) for a non-JSON body', async () => {
    const req = new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-key' },
      body: 'not json',
    })
    const res = await handleMcp(req, env, makeApi())
    expect(((await res.json()) as RpcResponse).error?.code).toBe(-32700)
  })

  it('returns an invalid-request error (-32600) when method is missing', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', id: 8 }), env, makeApi())
    expect(((await res.json()) as RpcResponse).error?.code).toBe(-32600)
  })

  it('returns an invalid-params error (-32602) for an unknown tool', async () => {
    const res = await handleMcp(
      mcpRequest({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'bogus', arguments: {} } }),
      env,
      makeApi(),
    )
    expect(((await res.json()) as RpcResponse).error?.code).toBe(-32602)
  })

  it('acks notifications/initialized with 202 and no body', async () => {
    const res = await handleMcp(
      mcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      env,
      makeApi(),
    )
    expect(res.status).toBe(202)
    expect(await res.text()).toBe('')
  })

  it('returns a JSON-RPC error for an unknown method', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', id: 9, method: 'bogus' }), env, makeApi())
    const body = (await res.json()) as RpcResponse
    expect(body.error?.code).toBe(-32601)
  })
})

describe('handleMcp — auth', () => {
  it('rejects a request with no bearer token (401)', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, null), env, makeApi())
    expect(res.status).toBe(401)
  })

  it('rejects a request with the wrong bearer token (401)', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'nope'), env, makeApi())
    expect(res.status).toBe(401)
  })

  it('rejects when MCP_API_KEY is unset on the Worker (401)', async () => {
    const noKeyEnv: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', OWNER_SECRET: 'owner-pw' }
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), noKeyEnv, makeApi())
    expect(res.status).toBe(401)
  })
})

describe('handleMcp — tools/list', () => {
  it('advertises get_schema, read_board and write_board with input schemas', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), env, makeApi())
    const body = (await res.json()) as RpcResponse
    const tools = (body.result as { tools: Array<{ name: string; inputSchema: unknown }> }).tools
    expect(tools.map((t) => t.name).sort()).toEqual(['get_schema', 'read_board', 'write_board'])
    expect(tools.every((t) => t.inputSchema)).toBe(true)
  })
})

describe('handleMcp — get_schema', () => {
  it('returns the JSON Schema derived from the trip document schema', async () => {
    const res = await handleMcp(
      mcpRequest({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_schema', arguments: {} } }),
      env,
      makeApi(),
    )
    const body = (await res.json()) as RpcResponse
    const tool = body.result as ToolResult
    const schema = JSON.parse(tool.content[0].text) as { type?: string; properties?: Record<string, unknown> }
    expect(schema.type).toBe('object')
    expect(Object.keys(schema.properties ?? {})).toEqual(
      expect.arrayContaining(['trip', 'cities', 'accommodations', 'cards', 'dayOverrides']),
    )
  })
})

describe('handleMcp — read_board', () => {
  function callRead(link: string, api = makeApi(seededDoc())) {
    return handleMcp(
      mcpRequest({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'read_board', arguments: { link } } }),
      env,
      api,
    )
  }

  it('reads the seeded trip from a full share link', async () => {
    const res = await callRead('https://travel-planner.pages.dev/#room=room1')
    const tool = ((await res.json()) as RpcResponse).result as ToolResult
    expect(tool.isError).toBeFalsy()
    const trip = JSON.parse(tool.content[0].text) as { trip: { title: string }; cities: Array<{ name: string }> }
    expect(trip.trip.title).toBe('Seed Trip')
    expect(trip.cities.map((c) => c.name)).toEqual(['Paris'])
  })

  it('accepts a bare #room= hash as the link', async () => {
    const res = await callRead('#room=room1')
    const tool = ((await res.json()) as RpcResponse).result as ToolResult
    const trip = JSON.parse(tool.content[0].text) as { trip: { title: string } }
    expect(trip.trip.title).toBe('Seed Trip')
  })

  it('returns an isError result when the link carries no room id', async () => {
    const res = await callRead('https://travel-planner.pages.dev/')
    const tool = ((await res.json()) as RpcResponse).result as ToolResult
    expect(tool.isError).toBe(true)
    expect(tool.content[0].text).toMatch(/room id/i)
  })

  it('returns an isError result when the room does not exist', async () => {
    const res = await callRead('https://app/#room=ghost', makeApi(seededDoc(), { roomExists: async () => false }))
    const tool = ((await res.json()) as RpcResponse).result as ToolResult
    expect(tool.isError).toBe(true)
    expect(tool.content[0].text).toMatch(/no board found/i)
  })

  it('returns an isError result (not an uncaught 502) when the doc is inconsistent', async () => {
    // A post-merge dangling reference makes `exportTrip` throw; read_board must
    // surface that as a tool error, not let it escape as a bare Worker 502.
    const seed = seededDoc()
    seed.getMap('dayOverrides').set('2027-01-01', 'ghost-city')
    const res = await callRead('https://app/#room=room1', makeApi(seed))
    const body = (await res.json()) as RpcResponse
    const tool = body.result as ToolResult
    expect(body.error).toBeUndefined()
    expect(tool.isError).toBe(true)
    expect(tool.content[0].text).toMatch(/inconsistent state/i)
  })
})

const validTrip = {
  trip: { title: 'Italy', startDate: '2027-05-01', numDays: 3, dayStart: '06:00', dayEnd: '21:00' },
  cities: [{ id: 'c2', name: 'Rome', color: '#ff0000' }],
  accommodations: [],
  cards: [{ id: 'k2', dayKey: '2027-05-01', title: 'Colosseum', order: 0 }],
  dayOverrides: {},
}

describe('handleMcp — write_board', () => {
  function callWrite(link: string, trip: unknown, api: TestApi = makeApi(seededDoc()), useEnv: Env = env) {
    return handleMcp(
      mcpRequest({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'write_board', arguments: { link, trip } },
      }),
      useEnv,
      api,
    )
  }

  async function toolOf(res: Response): Promise<ToolResult> {
    return ((await res.json()) as RpcResponse).result as ToolResult
  }

  it('writes a valid trip, reports success, and the update merges into a second doc', async () => {
    const seed = seededDoc()
    const api = makeApi(seed)
    const res = await callWrite('https://app/#room=room1', validTrip, api)

    const tool = await toolOf(res)
    expect(tool.isError).toBeFalsy()
    expect(tool.content[0].text).toMatch(/updated/i)
    expect(api.sentCount()).toBe(1)

    // Two-doc integration: a second client at the seed state applies the diff and converges.
    const docB = new Y.Doc()
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(seed))
    Y.applyUpdate(docB, api.lastUpdate()!)
    const merged = exportTrip(docB)
    expect(merged.trip.title).toBe('Italy')
    expect(merged.cities.map((c) => c.id)).toEqual(['c2'])
    expect(merged.cards.map((c) => c.id)).toEqual(['k2'])
  })

  it('snapshots the pre-write trip before applying', async () => {
    const kv = makeKv()
    const api = makeApi(seededDoc())
    await callWrite('https://app/#room=room1', validTrip, api, { ...env, SNAPSHOTS: kv })

    const snapshots = [...kv.store.values()]
    expect(snapshots).toHaveLength(1)
    // The captured snapshot is the state *before* the write (the seed), not the new trip.
    const snap = JSON.parse(snapshots[0]) as { trip: { title: string } }
    expect(snap.trip.title).toBe('Seed Trip')
  })

  it('does not promise a restorable version when no snapshot was recorded', async () => {
    // KV unbound → applyTripToRoom takes no snapshot; the success text must not
    // claim the previous version was snapshotted (there is nothing to restore).
    const api = makeApi(seededDoc())
    const res = await callWrite('https://app/#room=room1', validTrip, api, { ...env, SNAPSHOTS: undefined })
    const tool = await toolOf(res)
    expect(tool.isError).toBeFalsy()
    expect(tool.content[0].text).toMatch(/updated/i)
    expect(tool.content[0].text).not.toMatch(/snapshot|restore/i)
  })

  it('rejects an invalid trip with isError, mutating nothing and recording no snapshot', async () => {
    const kv = makeKv()
    const api = makeApi(seededDoc())
    const res = await callWrite(
      'https://app/#room=room1',
      { trip: { title: 'x', startDate: 'nope', numDays: -1 } },
      api,
      { ...env, SNAPSHOTS: kv },
    )

    const tool = await toolOf(res)
    expect(tool.isError).toBe(true)
    expect(tool.content[0].text).toMatch(/invalid/i)
    expect(api.sentCount()).toBe(0)
    expect(kv.store.size).toBe(0)
  })

  it('returns an isError result when the room does not exist, without writing', async () => {
    const api = makeApi(seededDoc(), { roomExists: async () => false })
    const res = await callWrite('https://app/#room=ghost', validTrip, api)
    const tool = await toolOf(res)
    expect(tool.isError).toBe(true)
    expect(tool.content[0].text).toMatch(/no board found/i)
    expect(api.sentCount()).toBe(0)
  })

  it('returns an isError result when the link carries no room id', async () => {
    const api = makeApi(seededDoc())
    const res = await callWrite('https://travel-planner.pages.dev/', validTrip, api)
    const tool = await toolOf(res)
    expect(tool.isError).toBe(true)
    expect(tool.content[0].text).toMatch(/room id/i)
    expect(api.sentCount()).toBe(0)
  })
})
