// KV-backed trip snapshot history. Every Worker-mediated write records the
// room's *current* trip JSON before the new one is applied, keeping all versions
// so a bad AI edit is a one-click revert (restore = re-apply an old snapshot).
//
// Snapshots are human-readable JSON keyed by room + a millisecond-timestamp id.
// A board export is ~10-20 KB and KV holds 1 GB, so keep-all is fine for a
// personal planner. Only the small slice of the KV API we use is typed here
// (same pattern as `LiveblocksApi`) — no `@cloudflare/workers-types` dependency,
// and tests inject an in-memory fake. The real Cloudflare `KVNamespace` binding
// is a structural superset, so it satisfies this interface at the call site.

export interface SnapshotKv {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  list(options: {
    prefix: string
    cursor?: string
  }): Promise<{ keys: Array<{ name: string }>; list_complete: boolean; cursor?: string }>
}

export interface SnapshotMeta {
  id: string
  timestamp: number
}

const PREFIX = 'snap:'

// Encode the room so a room containing ':' can't collide with the key delimiter
// (e.g. room "a" must never list room "a:b"'s snapshots).
function base(room: string): string {
  return `${PREFIX}${encodeURIComponent(room)}:`
}

// ponytail: 13-digit ms timestamps sort lexicographically until year 2286 and
// are unique unless two writes land in the same millisecond — impossible at
// human pace for a personal planner. Upgrade path if that ever matters: append
// a counter/random suffix and split it back off in `listSnapshots`.
function keyFor(room: string, id: string): string {
  return base(room) + id
}

/** Record the room's current trip JSON as a new keep-all snapshot; returns its meta. */
export async function recordSnapshot(
  kv: SnapshotKv,
  room: string,
  json: string,
  now: number = Date.now(),
): Promise<SnapshotMeta> {
  const id = String(now)
  await kv.put(keyFor(room, id), json)
  return { id, timestamp: now }
}

/** List a room's snapshots, newest first. */
export async function listSnapshots(kv: SnapshotKv, room: string): Promise<SnapshotMeta[]> {
  const prefix = base(room)
  // KV list() returns at most 1000 keys per call. Keep-all history can exceed
  // that, and keys sort oldest-first, so a single call would drop the *newest*
  // snapshots entirely — page through the cursor until the listing is complete.
  const names: string[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix, cursor })
    for (const k of page.keys) names.push(k.name)
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return names
    .map((name) => {
      const id = name.slice(prefix.length)
      return { id, timestamp: Number(id) }
    })
    .sort((a, b) => b.timestamp - a.timestamp)
}

/** Fetch a single snapshot's trip JSON, or null if it doesn't exist. */
export async function getSnapshot(
  kv: SnapshotKv,
  room: string,
  id: string,
): Promise<string | null> {
  return kv.get(keyFor(room, id))
}
