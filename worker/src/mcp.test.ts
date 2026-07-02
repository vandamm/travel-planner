// @vitest-environment node
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { handleMcp } from './mcp'
import type { Env, LiveblocksApi } from './liveblocks'
import { addCard, addCity, setTrip } from '../../src/data/doc'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', OWNER_SECRET: 'owner-pw', MCP_API_KEY: 'mcp-key' }

/** In-memory Liveblocks fake — same shape as the trip handler tests. */
function makeApi(seed?: Y.Doc, overrides: Partial<LiveblocksApi> = {}): LiveblocksApi {
  const state: Uint8Array = seed ? Y.encodeStateAsUpdate(seed) : new Uint8Array()
  return {
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async (room) => `tok-${room}`,
    getYUpdate: async () => state,
    sendYUpdate: async () => {},
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
  it('responds to initialize with capabilities + serverInfo, echoing the protocol version', async () => {
    const res = await handleMcp(
      mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }),
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
  it('advertises get_schema and read_board with input schemas', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), env, makeApi())
    const body = (await res.json()) as RpcResponse
    const tools = (body.result as { tools: Array<{ name: string; inputSchema: unknown }> }).tools
    expect(tools.map((t) => t.name).sort()).toEqual(['get_schema', 'read_board'])
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
})
