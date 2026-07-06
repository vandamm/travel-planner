// Worker-only token signing/verification. The Worker is the ONLY holder of
// TOKEN_SECRET, so signing and verifying live here (never shipped to the client).
// HMAC-SHA256 via Web Crypto (available in the Workers runtime); the payload
// codec + base64url helpers are shared with the client in src/data/token.ts.
//
// Token form: `<base64url(payload)>.<base64url(HMAC-SHA256(payloadSegment))>`.

import {
  base64urlDecode,
  base64urlEncode,
  decodePayload,
  encodePayload,
  type TokenPayload,
} from '../../src/data/token'

/**
 * Thrown when `TOKEN_SECRET` is absent or blank — a Worker misconfiguration, not
 * a bad token. Distinct so the router can answer 500 "server misconfigured"
 * instead of the generic 502 (which reads as a Liveblocks outage). Without this
 * guard an empty key reaches `crypto.subtle.importKey`, which throws an opaque
 * `DataError` ("Zero-length key is not supported").
 */
export class TokenConfigError extends Error {
  constructor() {
    super('TOKEN_SECRET is not configured')
    this.name = 'TokenConfigError'
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new TokenConfigError()
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Sign a payload, returning `<base64url(payload)>.<base64url(sig)>`. */
export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  const segment = encodePayload(payload)
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(segment))
  return `${segment}.${base64urlEncode(new Uint8Array(sig))}`
}

/** Constant-time-ish byte comparison — no early return on length-equal inputs. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Verify a token's signature and decode its payload. Returns the payload on a
 * valid signature, else null (malformed, tampered, or wrong-key). No security
 * decision may rest on anything but a non-null return here.
 */
export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return null
  const segment = token.slice(0, dot)
  const sigPart = token.slice(dot + 1)

  let providedSig: Uint8Array
  try {
    providedSig = base64urlDecode(sigPart)
  } catch {
    return null
  }

  const key = await hmacKey(secret)
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(segment)),
  )
  if (!timingSafeEqual(providedSig, expected)) return null

  return decodePayload(segment)
}
