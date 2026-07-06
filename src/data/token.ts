// Capability-token codec — shared by the client and the Worker. Browser/Worker-safe:
// only TextEncoder/TextDecoder + btoa/atob, no Node- or DOM-only APIs (per CLAUDE.md's
// "shared" rule). The Worker ALONE signs and verifies (worker/src/token.ts); this
// module only encodes the payload and DECODES it (NO signature check), so the client
// can shape local rendering from a pasted link. No security rests on the client decode.

/** Capability level a token grants. `owner` additionally authorizes room creation. */
export type Perm = 'view' | 'edit' | 'owner'

/** The signed token payload. Compact keys keep the URL fragment short. */
export interface TokenPayload {
  /** room id */
  r: string
  /** capability level */
  p: Perm
  /** optional display name (forwarded to Liveblocks as userInfo) */
  n?: string
  /** optional memorable-link slug (Phase-2 canonicalization; unused in Phase 1) */
  slug?: string
  /** payload version */
  v: 1
}

const PERMS: readonly Perm[] = ['view', 'edit', 'owner']

/**
 * The Liveblocks access scope a capability perm grants: `view` reads,
 * `edit`/`owner` write. Pure so it's unit-testable and shared (the Worker mints
 * with it; Phase-2 client uses it to shape read-only UX).
 */
export function liveblocksAccess(perm: Perm): 'room:read' | 'room:write' {
  return perm === 'view' ? 'room:read' : 'room:write'
}

/** base64url (no padding) of a byte array. */
export function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode base64url (no padding) back to bytes; throws on malformed input. */
export function base64urlDecode(s: string): Uint8Array {
  const binary = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Encode a payload to a base64url-JSON string (the token's first segment). */
export function encodePayload(payload: TokenPayload): string {
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)))
}

/** Decode a base64url-JSON payload segment. Returns null on any malformed/invalid input. */
export function decodePayload(segment: string): TokenPayload | null {
  try {
    const json = new TextDecoder().decode(base64urlDecode(segment))
    const obj: unknown = JSON.parse(json)
    return isValidPayload(obj) ? obj : null
  } catch {
    return null
  }
}

function isValidPayload(o: unknown): o is TokenPayload {
  if (typeof o !== 'object' || o === null) return false
  const p = o as Record<string, unknown>
  return (
    typeof p.r === 'string' &&
    p.r.length > 0 &&
    typeof p.p === 'string' &&
    (PERMS as readonly string[]).includes(p.p) &&
    p.v === 1 &&
    (p.n === undefined || typeof p.n === 'string') &&
    (p.slug === undefined || typeof p.slug === 'string')
  )
}

/** Extract the raw fragment/token from a full link, a `#…` hash, or a bare token. */
function fragmentOf(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  // A full URL carries the token only in its fragment; detect one by '://'.
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hash.replace(/^#/, '').trim()
    } catch {
      return ''
    }
  }
  return trimmed.replace(/^#/, '').trim()
}

/**
 * Parse a capability token out of a share link, a URL hash, or a bare token
 * string, returning its DECODED payload (NO signature verification — the client
 * only shapes local rendering from this; the Worker verifies). Returns null when
 * there's no decodable payload (e.g. an old `#room=…` fragment). The token form
 * is `<base64url(payload)>.<base64url(sig)>`; the payload is the first segment.
 */
export function parseToken(input: string): TokenPayload | null {
  const token = fragmentOf(input)
  if (!token) return null
  return decodePayload(token.split('.')[0])
}
