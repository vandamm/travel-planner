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
import { verifyToken } from './token'
import { applyTripToRoom, loadRoomDoc } from './trip'
import { exportTrip } from '../../src/data/exportTrip'
import { formatTripErrors, tripDocumentSchema } from '../../src/data/tripSchema'
import { permAtLeast, tokenFromLink, type Perm } from '../../src/data/token'

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
      description:
        'The full board share link (its # fragment is the access token that also authorizes this call), pasted verbatim.',
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
      description:
        'The full board share link (its # fragment is the access token that also authorizes this call), pasted verbatim.',
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
      "Read a travel board's current trip as JSON. Pass the board's share link — a view, edit, or owner link all work.",
    inputSchema: LINK_SCHEMA,
  },
  {
    name: 'write_board',
    description:
      "Replace a travel board's trip with an updated document. Pass an edit or owner share link (a view link can't write) and the full trip JSON (call get_schema first). The previous version is snapshotted, so the change can be reverted.",
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

/**
 * Verify the pasted link's capability token and resolve it to an existing room,
 * or a user-facing tool error. The link's # fragment IS the token — it is the
 * sole credential (no separate API key). `minPerm` gates the action: `read_board`
 * needs `view`+, `write_board` needs `edit`+.
 */
async function resolveRoom(
  env: Env,
  api: LiveblocksApi,
  link: string,
  minPerm: Perm,
): Promise<{ roomId: string } | { error: ToolResult }> {
  const raw = tokenFromLink(link)
  const payload = raw ? await verifyToken(raw, env.TOKEN_SECRET) : null
  if (!payload) {
    return {
      error: toolError(
        'That link is invalid or expired. Paste the full, current board share link.',
      ),
    }
  }
  if (!permAtLeast(payload.p, minPerm)) {
    return {
      error: toolError(
        `That link is ${payload.p}-only — it can't ${minPerm === 'edit' ? 'edit' : 'access'} this board. Use an ${minPerm} (or owner) link.`,
      ),
    }
  }
  if (!(await api.roomExists(payload.r))) {
    return { error: toolError(`No board found for room "${payload.r}". Check the link is current.`) }
  }
  return { roomId: payload.r }
}

async function readBoard(env: Env, api: LiveblocksApi, link: string): Promise<ToolResult> {
  const room = await resolveRoom(env, api, link, 'view')
  if ('error' in room) return room.error
  const doc = await loadRoomDoc(api, room.roomId)
  // `exportTrip` re-validates and throws on an inconsistent doc (e.g. concurrent
  // day-window edits that merge into dayEnd <= dayStart) — the same class of
  // state `applyTripToRoom` and the client panel already handle.
  // Surface it as a tool error, not an uncaught throw that becomes a bare 502.
  try {
    return toolText(JSON.stringify(exportTrip(doc), null, 2))
  } catch {
    return toolError(
      'The board could not be read as a valid trip — it is in an inconsistent state. ' +
        'Use write_board to replace it with a valid trip document.',
    )
  }
}

async function writeBoard(
  env: Env,
  api: LiveblocksApi,
  link: string,
  trip: unknown,
): Promise<ToolResult> {
  const room = await resolveRoom(env, api, link, 'edit')
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

  if (p.name === 'get_schema') {
    return rpcResult(id, toolText(JSON.stringify(zodToJsonSchema(tripDocumentSchema), null, 2)))
  }
  if (p.name === 'read_board') {
    const link = typeof args.link === 'string' ? args.link : ''
    return rpcResult(id, await readBoard(env, api, link))
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
  // No endpoint-level API key: discovery (initialize/tools/list) is open, and
  // each acting tool (read_board/write_board) authorizes itself from the token in
  // the pasted share link — that token is the sole credential.
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
    case 'initialize':
      // Per the MCP spec the server states a protocol version *it* supports, not
      // whatever the client requested — we implement exactly one.
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
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
