// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from './token'
import { encodePayload, type TokenPayload } from '../../src/data/token'

const SECRET = 'test-signing-secret'
const payload: TokenPayload = { r: 'paris-2026', p: 'owner', n: 'Alex', v: 1 }

describe('signToken / verifyToken', () => {
  it('signs then verifies (roundtrip)', async () => {
    const token = await signToken(payload, SECRET)
    expect(token).toContain('.')
    expect(await verifyToken(token, SECRET)).toEqual(payload)
  })

  it('rejects a tampered payload', async () => {
    const token = await signToken(payload, SECRET)
    const sig = token.slice(token.indexOf('.'))
    // Re-encode a different payload but keep the original signature.
    const forged = encodePayload({ ...payload, p: 'view' }) + sig
    expect(await verifyToken(forged, SECRET)).toBeNull()
  })

  it('rejects the wrong signing key', async () => {
    const token = await signToken(payload, SECRET)
    expect(await verifyToken(token, 'other-secret')).toBeNull()
  })

  it('rejects malformed tokens', async () => {
    expect(await verifyToken('no-dot-here', SECRET)).toBeNull()
    expect(await verifyToken('', SECRET)).toBeNull()
    expect(await verifyToken('.onlysig', SECRET)).toBeNull()
    expect(await verifyToken('onlypayload.', SECRET)).toBeNull()
    expect(await verifyToken(`${encodePayload(payload)}.@@bad-b64@@`, SECRET)).toBeNull()
  })

  it('rejects a valid signature over an invalid payload', async () => {
    // Sign a bogus (non-payload) segment so the signature matches but decode fails.
    const bogus = await signToken({ r: '', p: 'edit', v: 1 } as TokenPayload, SECRET)
    expect(await verifyToken(bogus, SECRET)).toBeNull()
  })
})
