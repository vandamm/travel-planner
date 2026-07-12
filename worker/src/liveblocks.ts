// Environment-agnostic Liveblocks access layer for the Worker.
//
// Rather than depend on `@liveblocks/node` (and node polyfills in the Workers
// runtime), we talk to the Liveblocks REST API with the platform `fetch`. The
// handlers depend only on the `LiveblocksApi` interface, so tests inject a fake
// and never hit the network.

import type { SnapshotKv } from './snapshots'

/** Worker environment bindings. Secrets are provided via `wrangler secret`/`.dev.vars`. */
export interface Env {
  /** Liveblocks project secret key — never shipped to the client. */
  LIVEBLOCKS_SECRET_KEY: string
  /** Cloudflare Access issuer, e.g. https://team.cloudflareaccess.com. */
  ACCESS_TEAM_DOMAIN?: string
  /** Cloudflare Access application audience tag. */
  ACCESS_AUD?: string
  /** Explicit local/test bypass identity. Never set in production. */
  DEV_AUTH_EMAIL?: string
  /** Optional CORS allow-list origin; defaults to reflecting/`*` when unset. */
  ALLOWED_ORIGIN?: string
  /**
   * KV namespace holding pre-write trip snapshots (version history). Optional so
   * the handlers still work if it isn't bound — writes just skip history then.
   * The real `KVNamespace` binding structurally satisfies `SnapshotKv`.
   */
  SNAPSHOTS?: SnapshotKv
}

/** The slice of Liveblocks we need. Real impl uses REST; tests inject a fake. */
export interface RoomPage {
  rooms: Array<{ id: string; createdAt: string }>
  nextCursor: string | null
}

export interface LiveblocksApi {
  /** List one page below Workers Free-plan subrequest limits. */
  listRooms(startingAfter?: string): Promise<RoomPage>
  /** True if a room with this id already exists. */
  roomExists(roomId: string): Promise<boolean>
  /** Create a room and return its id. */
  createRoom(roomId: string): Promise<{ id: string }>
  /**
   * Mint a room-scoped access token. `opts.access` sets the Liveblocks scope
   * (`room:write` for authenticated users); `opts.name`, when
   * present, is forwarded as `userInfo` for presence.
   */
  mintAccessToken(
    roomId: string,
    userId: string,
    opts: { access: 'room:read' | 'room:write'; name?: string },
  ): Promise<string>
  /**
   * Fetch the room's Yjs document encoded as a single binary update, ready for
   * `Y.applyUpdate`. Returns an empty array when the room has no Yjs data yet.
   */
  getYUpdate(roomId: string): Promise<Uint8Array>
  /**
   * Send a binary Yjs update to the room's document. Liveblocks merges it and
   * fans it out, so connected clients converge on the change in real time.
   */
  sendYUpdate(roomId: string, update: Uint8Array): Promise<void>
}

const LIVEBLOCKS_API = 'https://api.liveblocks.io/v2'

/** Build the production Liveblocks API backed by the REST endpoints. */
export function createLiveblocksApi(env: Env): LiveblocksApi {
  const authHeader = `Bearer ${env.LIVEBLOCKS_SECRET_KEY}`

  return {
    async listRooms(startingAfter) {
      const url = new URL(`${LIVEBLOCKS_API}/rooms`)
      url.searchParams.set('limit', '40')
      if (startingAfter) url.searchParams.set('startingAfter', startingAfter)
      const res = await fetch(url, {
        headers: { authorization: authHeader },
      })
      if (!res.ok) throw new Error(`Liveblocks room list failed: ${res.status}`)
      const body = (await res.json()) as {
        data: Array<{ id: string; createdAt: string }>
        nextCursor?: string | null
      }
      // ponytail: 40 room reads plus this list call stay below the Free-plan 50-subrequest limit.
      return {
        rooms: body.data.map(({ id, createdAt }) => ({ id, createdAt })),
        nextCursor: body.nextCursor ?? null,
      }
    },

    async roomExists(roomId) {
      const res = await fetch(`${LIVEBLOCKS_API}/rooms/${encodeURIComponent(roomId)}`, {
        headers: { authorization: authHeader },
      })
      if (res.status === 200) return true
      if (res.status === 404) return false
      throw new Error(`Liveblocks room lookup failed: ${res.status}`)
    },

    async createRoom(roomId) {
      const res = await fetch(`${LIVEBLOCKS_API}/rooms`, {
        method: 'POST',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        // `defaultAccesses: []` keeps the room private; the Worker grants access
        // per Access-authenticated session via the minted token.
        body: JSON.stringify({ id: roomId, defaultAccesses: [] }),
      })
      if (!res.ok) throw new Error(`Liveblocks room creation failed: ${res.status}`)
      const room = (await res.json()) as { id: string }
      return { id: room.id }
    },

    async mintAccessToken(roomId, userId, opts) {
      const res = await fetch(`${LIVEBLOCKS_API}/authorize-user`, {
        method: 'POST',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          // Scope access to exactly this room.
          permissions: { [roomId]: [opts.access] },
          ...(opts.name ? { userInfo: { name: opts.name } } : {}),
        }),
      })
      if (!res.ok) throw new Error(`Liveblocks token mint failed: ${res.status}`)
      const data = (await res.json()) as { token: string }
      return data.token
    },

    async getYUpdate(roomId) {
      const res = await fetch(`${LIVEBLOCKS_API}/rooms/${encodeURIComponent(roomId)}/ydoc-binary`, {
        headers: { authorization: authHeader },
      })
      // A room can exist without any Yjs data yet (e.g. created but never edited).
      if (res.status === 404) return new Uint8Array()
      if (!res.ok) throw new Error(`Liveblocks ydoc fetch failed: ${res.status}`)
      return new Uint8Array(await res.arrayBuffer())
    },

    async sendYUpdate(roomId, update) {
      const res = await fetch(`${LIVEBLOCKS_API}/rooms/${encodeURIComponent(roomId)}/ydoc`, {
        method: 'PUT',
        headers: { authorization: authHeader, 'content-type': 'application/octet-stream' },
        // Copy into a fresh, exactly-sized ArrayBuffer: a plain ArrayBuffer is an
        // unambiguous `BodyInit`, unlike the generic `Uint8Array<ArrayBufferLike>`.
        body: new Uint8Array(update).buffer,
      })
      if (!res.ok) throw new Error(`Liveblocks ydoc update failed: ${res.status}`)
    },
  }
}
