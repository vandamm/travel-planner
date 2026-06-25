// Environment-agnostic Liveblocks access layer for the Worker.
//
// Rather than depend on `@liveblocks/node` (and node polyfills in the Workers
// runtime), we talk to the Liveblocks REST API with the platform `fetch`. The
// handlers depend only on the `LiveblocksApi` interface, so tests inject a fake
// and never hit the network.

/** Worker environment bindings. Secrets are provided via `wrangler secret`/`.dev.vars`. */
export interface Env {
  /** Liveblocks project secret key — never shipped to the client. */
  LIVEBLOCKS_SECRET_KEY: string
  /** Owner secret that gates new-room creation (and, later, the agent API). */
  OWNER_SECRET: string
  /** Optional CORS allow-list origin; defaults to reflecting/`*` when unset. */
  ALLOWED_ORIGIN?: string
}

/** The slice of Liveblocks we need. Real impl uses REST; tests inject a fake. */
export interface LiveblocksApi {
  /** True if a room with this id already exists. */
  roomExists(roomId: string): Promise<boolean>
  /** Create a room and return its id. */
  createRoom(roomId: string): Promise<{ id: string }>
  /** Mint a room-scoped access token granting full (write) access. */
  mintAccessToken(roomId: string, userId: string): Promise<string>
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
        // `defaultAccesses: []` keeps the room private; access is granted per
        // session via the minted token, so only secret-link holders can join.
        body: JSON.stringify({ id: roomId, defaultAccesses: [] }),
      })
      if (!res.ok) throw new Error(`Liveblocks room creation failed: ${res.status}`)
      const room = (await res.json()) as { id: string }
      return { id: room.id }
    },

    async mintAccessToken(roomId, userId) {
      const res = await fetch(`${LIVEBLOCKS_API}/authorize-user`, {
        method: 'POST',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          // Grant full (read+write) access scoped to exactly this room.
          permissions: { [roomId]: ['room:write'] },
        }),
      })
      if (!res.ok) throw new Error(`Liveblocks token mint failed: ${res.status}`)
      const data = (await res.json()) as { token: string }
      return data.token
    },

    async getYUpdate(roomId) {
      const res = await fetch(
        `${LIVEBLOCKS_API}/rooms/${encodeURIComponent(roomId)}/ydoc-binary`,
        { headers: { authorization: authHeader } },
      )
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
