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
  try {
    // A full URL: the room id is only ever in the fragment.
    return roomIdFromHash(new URL(trimmed).hash)
  } catch {
    // Not a URL — treat the raw string as a hash or bare room id.
    return roomIdFromHash(trimmed)
  }
}
