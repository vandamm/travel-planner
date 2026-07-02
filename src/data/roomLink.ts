// Pure, environment-agnostic room-link parsing. Shared by the client (which
// reads `location.hash`) and the Worker's MCP tools (which parse a pasted share
// link string) so both derive the room id with the SAME logic — no drift.
// Kept free of browser-/Worker-only APIs per CLAUDE.md's "shared" rule.

/**
 * Extract the room id from a URL hash. Supports both `#room=<id>` and a bare
 * `#<id>`. Returns null when there is no usable room id.
 */
export function roomIdFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, '').trim()
  if (!raw) return null
  if (raw.includes('=')) {
    const room = new URLSearchParams(raw).get('room')?.trim()
    return room || null
  }
  return raw
}

/**
 * Extract the room id from a full share link (or a bare hash / id). The room id
 * lives only in the URL fragment (`#room=<id>`), so parse the fragment out of a
 * URL and reuse `roomIdFromHash`. A string that isn't a URL is treated as a
 * bare hash or room id. Returns null when the link carries no room id (e.g. a
 * fragment-less URL) — the caller answers "paste the full link".
 */
export function roomIdFromLink(link: string): string | null {
  const trimmed = link.trim()
  if (!trimmed) return null
  // A full URL carries the room id only in its fragment; detect one by its
  // scheme+authority ('://'). Anything else is a bare hash or room id — which may
  // itself contain ':' (e.g. "a:b"), so it must NOT go through the URL parser
  // (`new URL('a:b')` reads 'a:' as a scheme and yields an empty fragment).
  if (trimmed.includes('://')) {
    try {
      return roomIdFromHash(new URL(trimmed).hash)
    } catch {
      return null
    }
  }
  return roomIdFromHash(trimmed)
}
