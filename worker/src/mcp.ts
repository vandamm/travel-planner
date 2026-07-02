// MCP-over-HTTP endpoint for the Worker — lets an MCP client (e.g. Perplexity
// Pro) discover tools, read a room's trip from a pasted share link, and write an
// updated trip back. Tools: `get_schema`, `read_board`, `write_board`.
//
// ponytail: hand-rolled JSON-RPC 2.0 dispatch instead of `@modelcontextprotocol/sdk`.
// The SDK's Streamable-HTTP *server* transport is built on Node's http req/res
// and does not run on the Cloudflare Workers Fetch runtime; bridging it would be
// more code than the handshake itself. The surface we need is small and
// stateless — `initialize`, `tools/list`, `tools/call`, plus notification/ping
// acks — so we implement it directly and unit-test it with the same
// `LiveblocksApi` fake as the REST handlers. Upgrade path: adopt the SDK if a
// Workers-compatible transport lands or we need SSE server-initiated messages.

import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Env, LiveblocksApi } from './liveblocks'
import { applyTripToRoom, loadRoomDoc } from './trip'
import { exportTrip } from '../../src/data/exportTrip'
import { formatTripErrors, tripDocumentSchema } from '../../src/data/tripSchema'
import { roomIdFromLink } from '../../src/data/roomLink'

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'travel-planner', version: '1.0.0' }

/** MCP tool result content (the shape `tools/call` returns). */
interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

const LINK_SCHEMA = {
  type: 'object',
  properties: {
    link: {
      type: 'string',
      description: 'The full board share link (contains #room=...), pasted verbatim.',
    },
  },
  required: ['link'],
  additionalProperties: false,
} as const

const WRITE_SCHEMA = {
  type: 'object',
  properties: {
    link: {
      type: 'string',
      description: 'The full board share link (contains #room=...), pasted verbatim.',
    },
    trip: {
      type: 'object',
      description:
        'The full replacement trip document. Call get_schema first for its exact shape — write_board replaces the entire board.',
    },
  },
  required: ['link', 'trip'],
  additionalProperties: false,
} as const

const TOOLS = [
  {
    name: 'get_schema',
    description:
      'Return the JSON Schema for a trip document. Read this before writing so the trip JSON is valid.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_board',
    description:
      "Read a travel board's current trip as JSON. Pass the board's share link (the one containing #room=...).",
    inputSchema: LINK_SCHEMA,
  },
  {
    name: 'write_board',
    description:
      "Replace a travel board's trip with an updated document. Pass the board's share link and the full trip JSON (call get_schema first). The previous version is snapshotted, so the change can be reverted.",
    inputSchema: WRITE_SCHEMA,
  },
] as const

type JsonRpcId = string | number | null
interface JsonRpcRequest {
  jsonrpc?: string
  id?: JsonRpcId
  method?: string
  params?: unknown
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function rpcResult(id: JsonRpcId, result: unknown): Response {
  return json({ jsonrpc: '2.0', id, result })
}

function rpcError(id: JsonRpcId, code: number, message: string): Response {
  return json({ jsonrpc: '2.0', id, error: { code, message } })
}

function toolText(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function toolError(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

/** The MCP endpoint is gated by `MCP_API_KEY`, presented as a bearer token. */
function mcpAuthorized(request: Request, env: Env): boolean {
  if (!env.MCP_API_KEY) return false
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  return bearer === env.MCP_API_KEY
}

/** Resolve a pasted link to an existing room id, or a user-facing error result. */
async function resolveRoom(
  api: LiveblocksApi,
  link: string,
): Promise<{ roomId: string } | { error: ToolResult }> {
  const roomId = roomIdFromLink(link)
  if (!roomId) {
    return {
      error: toolError(
        'Could not find a room id in that link. Paste the full board link — it contains "#room=...".',
      ),
    }
  }
  if (!(await api.roomExists(roomId))) {
    return { error: toolError(`No board found for room "${roomId}". Check the link is current.`) }
  }
  return { roomId }
}

async function readBoard(api: LiveblocksApi, link: string): Promise<ToolResult> {
  const room = await resolveRoom(api, link)
  if ('error' in room) return room.error
  const doc = await loadRoomDoc(api, room.roomId)
  return toolText(JSON.stringify(exportTrip(doc), null, 2))
}

async function writeBoard(
  env: Env,
  api: LiveblocksApi,
  link: string,
  trip: unknown,
): Promise<ToolResult> {
  const room = await resolveRoom(api, link)
  if ('error' in room) return room.error

  // Validate before touching the room so a bad payload never mutates the doc (nor
  // records a snapshot); the same schema the UI and REST API use.
  const parsed = tripDocumentSchema.safeParse(trip)
  if (!parsed.success) {
    return toolError(`The trip JSON is invalid:\n${formatTripErrors(parsed.error)}`)
  }

  const data = await applyTripToRoom(env, api, room.roomId, parsed.data)
  return toolText(
    `Board updated: "${data.trip.title || '(untitled)'}" — ${data.cities.length} ` +
      `cities, ${data.cards.length} cards, ${data.accommodations.length} accommodations. ` +
      'The previous version was snapshotted and can be restored.',
  )
}

async function handleToolCall(
  id: JsonRpcId,
  params: unknown,
  env: Env,
  api: LiveblocksApi,
): Promise<Response> {
  const p = (params ?? {}) as { name?: unknown; arguments?: unknown }
  const args = (p.arguments ?? {}) as Record<string, unknown>

  if (p.name === 'get_schema') {
    return rpcResult(id, toolText(JSON.stringify(zodToJsonSchema(tripDocumentSchema), null, 2)))
  }
  if (p.name === 'read_board') {
    const link = typeof args.link === 'string' ? args.link : ''
    return rpcResult(id, await readBoard(api, link))
  }
  if (p.name === 'write_board') {
    const link = typeof args.link === 'string' ? args.link : ''
    return rpcResult(id, await writeBoard(env, api, link, args.trip))
  }
  return rpcError(id, -32602, `Unknown tool: ${String(p.name)}`)
}

/**
 * Handle one MCP JSON-RPC request. Requests (with an `id`) get a JSON-RPC
 * response; notifications (`notifications/*`) are acked with 202 and no body.
 */
export async function handleMcp(
  request: Request,
  env: Env,
  api: LiveblocksApi,
): Promise<Response> {
  if (!mcpAuthorized(request, env)) {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'unauthorized' } }, 401)
  }

  let body: JsonRpcRequest
  try {
    body = (await request.json()) as JsonRpcRequest
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  const method = body.method
  const id = body.id ?? null
  if (typeof method !== 'string') return rpcError(id, -32600, 'Invalid request')

  // Notifications (e.g. `notifications/initialized`) carry no id and expect no
  // JSON-RPC response — just acknowledge receipt.
  if (method.startsWith('notifications/')) return new Response(null, { status: 202 })

  switch (method) {
    case 'initialize': {
      const requested = (body.params as { protocolVersion?: unknown } | undefined)?.protocolVersion
      return rpcResult(id, {
        protocolVersion: typeof requested === 'string' ? requested : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS })
    case 'tools/call':
      return await handleToolCall(id, body.params, env, api)
    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}
