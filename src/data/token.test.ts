import { describe, it, expect } from 'vitest'
import {
  encodePayload,
  decodePayload,
  parseToken,
  liveblocksAccess,
  permAtLeast,
  type TokenPayload,
} from './token'

const payload: TokenPayload = { r: 'paris-2026', p: 'edit', v: 1 }

describe('encodePayload / decodePayload', () => {
  it('roundtrips a payload', () => {
    expect(decodePayload(encodePayload(payload))).toEqual(payload)
  })

  it('roundtrips optional name + slug (incl. unicode)', () => {
    const full: TokenPayload = { r: 'r1', p: 'owner', n: 'Zoë ✈️', slug: 'italy', v: 1 }
    expect(decodePayload(encodePayload(full))).toEqual(full)
  })

  it('returns null for a malformed base64/JSON segment', () => {
    expect(decodePayload('not-valid-@@')).toBeNull()
    expect(decodePayload('')).toBeNull()
  })

  it('returns null when required fields are missing or wrong', () => {
    const enc = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodePayload(enc({ p: 'edit', v: 1 }))).toBeNull() // no room
    expect(decodePayload(enc({ r: 'x', p: 'edit', v: 2 }))).toBeNull() // bad version
    expect(decodePayload(enc({ r: 'x', p: 'admin', v: 1 }))).toBeNull() // bad perm
    expect(decodePayload(enc({ r: 'x', p: 'view', n: 5, v: 1 }))).toBeNull() // bad name type
  })
})

describe('liveblocksAccess', () => {
  it('maps view → room:read and edit/owner → room:write', () => {
    expect(liveblocksAccess('view')).toBe('room:read')
    expect(liveblocksAccess('edit')).toBe('room:write')
    expect(liveblocksAccess('owner')).toBe('room:write')
  })
})

describe('permAtLeast', () => {
  it('treats view ⊂ edit ⊂ owner', () => {
    expect(permAtLeast('view', 'view')).toBe(true)
    expect(permAtLeast('edit', 'view')).toBe(true)
    expect(permAtLeast('owner', 'edit')).toBe(true)
    expect(permAtLeast('view', 'edit')).toBe(false)
    expect(permAtLeast('edit', 'owner')).toBe(false)
  })
})

describe('parseToken', () => {
  const token = `${encodePayload(payload)}.someSignatureSegment`

  it('parses a bare token string', () => {
    expect(parseToken(token)).toEqual(payload)
  })

  it('parses a `#<token>` hash', () => {
    expect(parseToken(`#${token}`)).toEqual(payload)
  })

  it('parses a full share link fragment', () => {
    expect(parseToken(`https://trips.example.com/#${token}`)).toEqual(payload)
  })

  it('parses a payload-only token (no signature segment)', () => {
    expect(parseToken(encodePayload(payload))).toEqual(payload)
  })

  it('returns null for an old `#room=…` fragment', () => {
    expect(parseToken('#room=paris-2026')).toBeNull()
  })

  it('returns null for empty / fragment-less input', () => {
    expect(parseToken('')).toBeNull()
    expect(parseToken('   ')).toBeNull()
    expect(parseToken('https://trips.example.com/')).toBeNull()
  })
})
