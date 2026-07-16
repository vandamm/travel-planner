# MCP shared trip discovery

## Scope

The MCP server exposes one shared trip library. Every account admitted by the
existing Cloudflare Access policy may list, read, and write every trip. The MCP
does not add per-user ownership or membership rules.

The existing `get_schema`, `read_board`, and `write_board` tool names remain
stable. This revision adds trip discovery, improves client guidance and result
metadata, hardens the HTTP protocol boundary, and replaces stale link-sharing
documentation.

## Trip discovery

Add a read-only `list_trips` tool with an optional opaque `cursor` argument. One
call reads one Liveblocks room page and returns:

- `trips`: summaries containing `slug`, `title`, `startDate`, `endDate`,
  `color`, and `createdAt`;
- `nextCursor`: the opaque cursor for the next page, when another page exists.

The tool returns both `structuredContent` and matching serialized JSON text for
older clients. It declares an output schema. Pagination remains explicit so one
Worker request stays within the existing Liveblocks subrequest budget.

Extract the current room-summary loading logic from `handleListRooms` into one
shared function. The REST endpoint keeps its current response, including `id`
as the room identifier. The MCP adapter maps `id` to the clearer `slug` field.
The shared loader preserves the current handling of invalid rooms, unreadable
rooms, pagination, and missing trip colors.

## MCP discovery and tools

Initialization instructions tell clients to:

1. call `list_trips` when the user has not supplied a slug;
2. call `read_board` before editing;
3. call `get_schema` before constructing a write payload;
4. call `write_board` with the slug and the complete replacement document.

The instructions name the four available tools and state that the server has no
booking, routing, weather, flight, hotel, or place-search tools. `tools/list`
remains the authoritative tool catalogue.

The tool capability keeps `listChanged` absent because the catalogue is static
and this stateless server does not emit tool-list notifications. Tool definitions
gain titles and annotations: schema, listing, and reading are read-only;
`write_board` is destructive because it replaces the complete trip. Read and
list results gain structured output and output schemas while retaining text for
client compatibility.

## Protocol and security

Support protocol revisions `2025-11-25` and `2025-06-18`. Initialization echoes
a requested supported revision; otherwise it returns the newest supported
revision. Requests with a present but unsupported `MCP-Protocol-Version` header
receive HTTP 400. A missing header remains accepted for existing clients.

Validate JSON-RPC envelopes at the MCP boundary, including `jsonrpc: "2.0"`,
request identifiers, method names, and notification shape. The server remains
stateless, returns JSON responses to POST requests, acknowledges notifications
with HTTP 202, and returns HTTP 405 for GET because it does not offer SSE.

Accept requests without an `Origin` header, as native MCP clients commonly omit
it. When `Origin` is present, require an exact match with `ALLOWED_ORIGIN` and
return HTTP 403 on mismatch. Cloudflare Access remains the sole authentication
and library-level authorization gate.

Tool execution failures return MCP tool errors with `isError: true`; malformed
protocol requests remain JSON-RPC errors. Authentication failures remain HTTP
401 responses from Cloudflare Access or the Worker boundary.

## Documentation

Rewrite the root README sections that still describe hash links, capability
tokens, owner secrets, and anonymous collaboration. Document slug URLs,
Cloudflare Access login, the shared trip homepage, the Access-protected REST
API, and the four MCP tools. Update the focused MCP references in deployment and
trip-schema documentation to include `list_trips` and the discovery workflow.

## Tests

- `list_trips` returns one structured page, maps IDs to slugs, and preserves the
  next cursor.
- `list_trips` reports upstream failures as tool errors.
- initialization advertises the workflow without claiming `listChanged`.
- supported protocol versions negotiate correctly; unsupported headers fail.
- missing origins are accepted; mismatched origins receive HTTP 403.
- JSON-RPC validation rejects malformed envelopes and accepts notifications.
- existing schema, read, write, Access, room-listing, and snapshot tests remain
  green.

## Exclusions

This revision adds no trip creation or deletion tools, per-user permissions,
MCP resources or prompts, SSE, session state, SDK dependency, booking tools, or
trip-schema changes.
