// MCP-over-HTTP endpoint for the Worker — lets an Access-authenticated MCP
// client discover tools, read a slug room's trip, and write an updated trip back.
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
import { isValidSlug } from '../../src/data/slug'
import { listRoomSummaries } from './rooms'

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18'] as const
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0]
const SERVER_INFO = { name: 'travel-planner', version: '1.0.0' }
const SERVER_INSTRUCTIONS =
  'This server reads and writes the shared travel.vansach.me trip library. ' +
  'Call tools/list to discover the available tools. When the user has not supplied a trip, ' +
  'call list_trips, then read_board with its slug. Before writing, call get_schema and then ' +
  'write_board with the same slug and the complete replacement trip document. Available tools ' +
  'are get_schema, list_trips, read_board, and write_board; there are no booking, routing, ' +
  'weather, flight, hotel, or place-search tools.'
const TRIP_OUTPUT_SCHEMA = zodToJsonSchema(tripDocumentSchema)

/** MCP tool result content (the shape `tools/call` returns). */
interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

const SLUG_SCHEMA = {
  type: 'object',
  properties: {
    slug: {
      type: 'string',
      description: 'The room slug from the board URL, for example "italy-2027".',
    },
  },
  required: ['slug'],
  additionalProperties: false,
} as const

const WRITE_SCHEMA = {
  type: 'object',
  properties: {
    slug: {
      type: 'string',
      description: 'The room slug from the board URL, for example "italy-2027".',
    },
    trip: {
      type: 'object',
      description:
        'The full replacement trip document. Call get_schema first for its exact shape — write_board replaces the entire board.',
    },
  },
  required: ['slug', 'trip'],
  additionalProperties: false,
} as const

const LIST_TRIPS_SCHEMA = {
  type: 'object',
  properties: {
    cursor: {
      type: 'string',
      description: 'Opaque cursor from a previous list_trips result.',
    },
  },
  additionalProperties: false,
} as const

const LIST_TRIPS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    trips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          color: { type: 'string' },
          createdAt: { type: 'string' },
        },
        required: ['slug', 'title', 'startDate', 'endDate', 'color', 'createdAt'],
        additionalProperties: false,
      },
    },
    nextCursor: { type: ['string', 'null'] },
  },
  required: ['trips', 'nextCursor'],
  additionalProperties: false,
} as const

const TOOLS = [
  {
    name: 'get_schema',
    title: 'Get trip schema',
    description:
      'Return the JSON Schema for a trip document. Read this before writing so the trip JSON is valid.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'list_trips',
    title: 'List shared trips',
    description:
      'List one page of trip summaries available to every Cloudflare Access-approved user. Use nextCursor to fetch another page.',
    inputSchema: LIST_TRIPS_SCHEMA,
    outputSchema: LIST_TRIPS_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'read_board',
    title: 'Read trip board',
    description: "Read a travel board's current trip as JSON. Pass the board slug from its URL.",
    inputSchema: SLUG_SCHEMA,
    outputSchema: TRIP_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'write_board',
    title: 'Replace trip board',
    description:
      "Replace a travel board's trip with an updated document. Pass the board slug and the full trip JSON (call get_schema first). The previous version is snapshotted, so the change can be reverted.",
    inputSchema: WRITE_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
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

function rpcError(id: JsonRpcId, code: number, message: string, status = 200): Response {
  return json({ jsonrpc: '2.0', id, error: { code, message } }, status)
}

function toolText(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function toolJson(data: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

function toolError(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

function supportedProtocolVersion(value: unknown): string {
  return typeof value === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(value as never)
    ? value
    : LATEST_PROTOCOL_VERSION
}

/**
 * Resolve a slug to an existing room. Cloudflare Access gates the endpoint before
 * any tool reaches here.
 */
async function resolveRoom(
  _env: Env,
  api: LiveblocksApi,
  slug: string,
): Promise<{ roomId: string } | { error: ToolResult }> {
  if (!isValidSlug(slug)) return { error: toolError('That room slug is invalid.') }
  if (!(await api.roomExists(slug))) {
    return { error: toolError(`No board found for room "${slug}". Check the slug is current.`) }
  }
  return { roomId: slug }
}

async function readBoard(env: Env, api: LiveblocksApi, slug: string): Promise<ToolResult> {
  const room = await resolveRoom(env, api, slug)
  if ('error' in room) return room.error
  const doc = await loadRoomDoc(api, room.roomId)
  // `exportTrip` re-validates and throws on an inconsistent doc (e.g. concurrent
  // day-window edits that merge into dayEnd <= dayStart) — the same class of
  // state `applyTripToRoom` and the client panel already handle.
  // Surface it as a tool error, not an uncaught throw that becomes a bare 502.
  try {
    return toolJson(exportTrip(doc))
  } catch {
    return toolError(
      'The board could not be read as a valid trip — it is in an inconsistent state. ' +
        'Use write_board to replace it with a valid trip document.',
    )
  }
}

async function listTrips(api: LiveblocksApi, cursor?: string): Promise<ToolResult> {
  const { trips, nextCursor } = await listRoomSummaries(api, cursor)
  return toolJson({
    trips: trips.map(({ id, ...trip }) => ({ slug: id, ...trip })),
    nextCursor,
  })
}

async function writeBoard(
  env: Env,
  api: LiveblocksApi,
  slug: string,
  trip: unknown,
): Promise<ToolResult> {
  const room = await resolveRoom(env, api, slug)
  if ('error' in room) return room.error

  // Validate before touching the room so a bad payload never mutates the doc (nor
  // records a snapshot); the same schema the UI and REST API use.
  const parsed = tripDocumentSchema.safeParse(trip)
  if (!parsed.success) {
    return toolError(`The trip JSON is invalid:\n${formatTripErrors(parsed.error)}`)
  }

  const { data, snapshotted } = await applyTripToRoom(env, api, room.roomId, parsed.data)
  const summary =
    `Board updated: "${data.trip.title || '(untitled)'}" — ${data.cities.length} ` +
    `cities, ${data.cards.length} cards, ${data.accommodations.length} accommodations.`
  return toolText(
    snapshotted ? `${summary} The previous version was snapshotted and can be restored.` : summary,
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

  try {
    if (p.name === 'get_schema') {
      return rpcResult(id, toolJson(TRIP_OUTPUT_SCHEMA))
    }
    if (p.name === 'list_trips') {
      const cursor = typeof args.cursor === 'string' ? args.cursor : undefined
      return rpcResult(id, await listTrips(api, cursor))
    }
    if (p.name === 'read_board') {
      const slug = typeof args.slug === 'string' ? args.slug : ''
      return rpcResult(id, await readBoard(env, api, slug))
    }
    if (p.name === 'write_board') {
      const slug = typeof args.slug === 'string' ? args.slug : ''
      return rpcResult(id, await writeBoard(env, api, slug, args.trip))
    }
  } catch {
    return rpcResult(id, toolError('The trip service is temporarily unavailable. Try again.'))
  }
  return rpcError(id, -32602, `Unknown tool: ${String(p.name)}`)
}

/**
 * Handle one MCP JSON-RPC request. Requests (with an `id`) get a JSON-RPC
 * response; notifications (`notifications/*`) are acked with 202 and no body.
 */
export async function handleMcp(request: Request, env: Env, api: LiveblocksApi): Promise<Response> {
  // Cloudflare Access gates this endpoint before the MCP request is dispatched.
  const headerVersion = request.headers.get('mcp-protocol-version')
  if (headerVersion && !SUPPORTED_PROTOCOL_VERSIONS.includes(headerVersion as never)) {
    return rpcError(null, -32600, 'Unsupported protocol version', 400)
  }

  let body: JsonRpcRequest
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return rpcError(null, -32600, 'Invalid request')
    }
    body = parsed as JsonRpcRequest
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  const method = body.method
  if (body.jsonrpc !== '2.0' || typeof method !== 'string') {
    return rpcError(null, -32600, 'Invalid request')
  }

  // Notifications (e.g. `notifications/initialized`) carry no id and expect no
  // JSON-RPC response — just acknowledge receipt.
  if (body.id === undefined) {
    return method.startsWith('notifications/')
      ? new Response(null, { status: 202 })
      : rpcError(null, -32600, 'Invalid request')
  }
  if (body.id === null || (typeof body.id !== 'string' && typeof body.id !== 'number')) {
    return rpcError(null, -32600, 'Invalid request')
  }
  const id = body.id

  switch (method) {
    case 'initialize':
      // Prefer the requested revision when supported; otherwise negotiate the
      // newest revision this stateless server supports.
      return rpcResult(id, {
        protocolVersion: supportedProtocolVersion(
          (body.params as { protocolVersion?: unknown } | undefined)?.protocolVersion,
        ),
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      })
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
