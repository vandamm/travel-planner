# MCP Shared Trip Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Cloudflare Access-approved MCP clients discover every shared trip, then safely read and replace a selected trip.

**Architecture:** Extract the existing paginated Liveblocks summary loading from the REST room handler. The MCP handler calls that shared loader through a small adapter that maps room IDs to slugs and returns structured tool output. Keep the service stateless and Access-protected; add only origin and protocol-header validation at the HTTP boundary.

**Tech Stack:** TypeScript, Cloudflare Workers Fetch API, Vitest, Yjs, Liveblocks REST API, Zod-derived JSON Schema.

## Global Constraints

- All Access-approved accounts share the entire trip library.
- Keep `get_schema`, `read_board`, and `write_board` names stable.
- Add no dependencies, sessions, SSE, resources, prompts, booking tools, or per-user permissions.
- `list_trips` is explicit-cursor pagination; it must not fetch multiple Liveblocks pages in one Worker request.
- Keep `listChanged` absent because the stateless server cannot send notifications.
- Accept requests with no `Origin`; reject a present origin that differs from `ALLOWED_ORIGIN`.
- Support MCP revisions `2025-11-25` and `2025-06-18`.

---

### Task 1: Share paginated trip summaries

**Files:**
- Modify: `worker/src/rooms.ts:1-51`
- Modify: `worker/src/rooms.test.ts:1-147`

**Interfaces:**
- Produces: `listRoomSummaries(api: LiveblocksApi, cursor?: string): Promise<{ trips: RoomSummary[]; nextCursor: string | null }>`.
- `RoomSummary` contains `id`, `createdAt`, and the existing trip settings returned by `getTrip`.
- `handleListRooms` consumes `listRoomSummaries` and preserves `{ trips, nextCursor }` as its HTTP body.

- [ ] **Step 1: Write the failing shared-loader test**

```ts
it('loads one summary page through the shared loader', async () => {
  const { api } = makeApi({
    listRooms: async () => ({
      rooms: [{ id: 'japan-2028', createdAt: '2027-01-01T00:00:00Z' }],
      nextCursor: 'next-page',
    }),
    getYUpdate: async () => Y.encodeStateAsUpdate(doc),
  })

  await expect(listRoomSummaries(api)).resolves.toEqual({
    trips: [expect.objectContaining({ id: 'japan-2028', title: 'Japan' })],
    nextCursor: 'next-page',
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run worker/src/rooms.test.ts`

Expected: FAIL because `listRoomSummaries` is not exported.

- [ ] **Step 3: Extract the minimal shared loader**

```ts
export async function listRoomSummaries(api: LiveblocksApi, cursor?: string) {
  const { rooms, nextCursor } = await api.listRooms(cursor)
  // Preserve the existing valid-slug filter, Yjs loading, colour backfill,
  // allSettled filtering, and returned summary shape.
  return { trips, nextCursor }
}

export async function handleListRooms(request: Request, api: LiveblocksApi): Promise<Response> {
  const cursor = new URL(request.url).searchParams.get('cursor') || undefined
  return json(await listRoomSummaries(api, cursor))
}
```

- [ ] **Step 4: Run the room tests to verify they pass**

Run: `npm test -- --run worker/src/rooms.test.ts`

Expected: PASS with the existing room tests plus the new shared-loader test.

- [ ] **Step 5: Commit the shared loader**

```sh
git add worker/src/rooms.ts worker/src/rooms.test.ts
git commit -m "refactor: share trip summary loading"
```

### Task 2: Add discovery and complete MCP tool metadata

**Files:**
- Modify: `worker/src/mcp.ts:13-235`
- Modify: `worker/src/mcp.test.ts:1-114`

**Interfaces:**
- Consumes: `listRoomSummaries(api, cursor?)` from `worker/src/rooms.ts`.
- Produces: `list_trips({ cursor?: string })`, returning text and `structuredContent` with `{ trips: Array<{ slug, title, startDate, endDate, color, createdAt }>, nextCursor }`.
- Produces: initialization instructions for `list_trips → read_board → get_schema → write_board`.

- [ ] **Step 1: Write failing MCP tests**

```ts
it('lists one page of shared trips by slug', async () => {
  const body = await rpc(makeApi({
    listRooms: async () => ({ rooms: [{ id: 'rome-2027', createdAt: '2027-01-01T00:00:00Z' }], nextCursor: 'next' }),
  }), 'tools/call', { name: 'list_trips', arguments: {} })

  expect(JSON.stringify(body.result)).toContain('rome-2027')
  expect(JSON.stringify(body.result)).toContain('structuredContent')
  expect(JSON.stringify(body.result)).toContain('next')
})

it('instructs clients to discover trips without claiming tool-list notifications', async () => {
  const init = await rpc(makeApi(), 'initialize', {
    protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' },
  })

  expect(JSON.stringify(init.result)).toContain('list_trips')
  expect(JSON.stringify(init.result)).not.toContain('listChanged')
})
```

- [ ] **Step 2: Run the MCP tests to verify they fail**

Run: `npm test -- --run worker/src/mcp.test.ts`

Expected: FAIL because `list_trips` and the initialization instructions do not exist.

- [ ] **Step 3: Implement the minimal tool surface**

```ts
const LIST_TRIPS_SCHEMA = {
  type: 'object',
  properties: { cursor: { type: 'string', description: 'Opaque cursor from a prior list_trips result.' } },
  additionalProperties: false,
} as const

async function listTrips(api: LiveblocksApi, cursor?: string): Promise<ToolResult> {
  const { trips, nextCursor } = await listRoomSummaries(api, cursor)
  const data = { trips: trips.map(({ id, ...trip }) => ({ slug: id, ...trip })), nextCursor }
  return toolJson(data)
}
```

Add a `list_trips` definition before `read_board`, output schemas and read-only
annotations for read tools, destructive annotation for `write_board`, and an
`instructions` string to the initialize response. Catch operational tool errors
in `handleToolCall` and return `toolError` rather than an HTTP 502.

- [ ] **Step 4: Run MCP tests to verify they pass**

Run: `npm test -- --run worker/src/mcp.test.ts`

Expected: PASS, including list pagination, structured output, and instructions.

- [ ] **Step 5: Commit MCP discovery**

```sh
git add worker/src/mcp.ts worker/src/mcp.test.ts
git commit -m "feat: add MCP trip discovery"
```

### Task 3: Harden the MCP HTTP boundary

**Files:**
- Modify: `worker/src/index.ts:31-105`
- Modify: `worker/src/index.test.ts:1-136`
- Modify: `worker/src/mcp.ts:196-235`
- Modify: `worker/src/mcp.test.ts:62-114`

**Interfaces:**
- `handleRequest` rejects a present `Origin` that differs from `env.ALLOWED_ORIGIN` with HTTP 403.
- `handleMcp` accepts only JSON-RPC 2.0 requests, differentiates notifications from requests, and checks a present `MCP-Protocol-Version` against `['2025-11-25', '2025-06-18']`.

- [ ] **Step 1: Write failing origin and protocol tests**

```ts
it('rejects an unexpected Origin on MCP requests', async () => {
  const res = await handleRequest(
    new Request('https://worker.test/mcp', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) }),
    { ...env, ALLOWED_ORIGIN: 'https://travel.example' }, makeApi(),
  )
  expect(res.status).toBe(403)
})

it('rejects a present unsupported protocol version', async () => {
  const res = await handleMcp(request({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '2099-01-01' }), env, makeApi())
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: Run the boundary tests to verify they fail**

Run: `npm test -- --run worker/src/index.test.ts worker/src/mcp.test.ts`

Expected: FAIL because mismatched origins and unsupported headers currently pass.

- [ ] **Step 3: Add boundary validation**

```ts
function allowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin')
  return !origin || !env.ALLOWED_ORIGIN || origin === env.ALLOWED_ORIGIN
}

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18'] as const

function requestedProtocolIsSupported(request: Request): boolean {
  const version = request.headers.get('mcp-protocol-version')
  return !version || SUPPORTED_PROTOCOL_VERSIONS.includes(version as never)
}
```

Call `allowedOrigin` before CORS preflight or protected-route handling. Return
HTTP 403 for a mismatched present origin. Reject unsupported present protocol
headers with HTTP 400 before parsing JSON. Validate `body.jsonrpc === '2.0'` and
keep notifications as HTTP 202 with no response body.

- [ ] **Step 4: Run boundary tests to verify they pass**

Run: `npm test -- --run worker/src/index.test.ts worker/src/mcp.test.ts`

Expected: PASS with origin rejection, protocol validation, and existing Access coverage.

- [ ] **Step 5: Commit protocol hardening**

```sh
git add worker/src/index.ts worker/src/index.test.ts worker/src/mcp.ts worker/src/mcp.test.ts
git commit -m "fix: harden MCP transport boundary"
```

### Task 4: Update operator and connector documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment.md:102-116`
- Modify: `docs/trip-schema.md:111-132`

**Interfaces:**
- Documents the deployed URL format `https://travel.vansach.me/<slug>`.
- Documents Cloudflare Access login for browser, REST, and MCP clients.
- Documents `list_trips`, `read_board`, `get_schema`, and `write_board` in that order.

- [ ] **Step 1: Write the documentation changes**

Replace the root README's capability-link and owner-secret narrative with the
current Access-authenticated slug model. Add the shared trip homepage and
MCP discovery workflow. Update deployment and schema documentation with:

```text
Connect to https://travel.vansach.me/mcp through Cloudflare Access Managed OAuth.
Call list_trips to select a slug, read_board to load it, get_schema before a
write, and write_board with the complete replacement document.
```

- [ ] **Step 2: Verify documentation contains no obsolete auth guidance**

Run: `rg -n -i "secret link|owner secret|x-owner-secret|#<roomId>|capability token" README.md docs/deployment.md docs/trip-schema.md`

Expected: no stale README or deployment guidance; historical references outside
these files remain untouched.

- [ ] **Step 3: Commit documentation**

```sh
git add README.md docs/deployment.md docs/trip-schema.md
git commit -m "docs: describe Access-authenticated MCP discovery"
```

### Task 5: Run complete verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run the focused Worker suite**

Run: `npm test -- --run worker/src/mcp.test.ts worker/src/index.test.ts worker/src/rooms.test.ts`

Expected: all Worker tests pass.

- [ ] **Step 2: Run the full unit and integration suite**

Run: `npm test`

Expected: exit code 0 with no failed test files.

- [ ] **Step 3: Run build and formatting checks**

Run: `npm run build && npm run lint && git diff --check main...HEAD`

Expected: every command exits 0 and `git diff --check` prints no errors.

- [ ] **Step 4: Inspect the complete diff**

Run: `git diff --stat main...HEAD && git status --short --branch`

Expected: only the approved MCP implementation, tests, documentation, plan, and
design commits differ from `main`; working tree is clean.
