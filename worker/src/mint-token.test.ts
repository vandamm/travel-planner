// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { mintToken, parseDevVar } from '../../scripts/mint-token'
import { verifyToken } from './token'

const SECRET = 'test-token-secret'

describe('mintToken', () => {
  it('mints a token that verifyToken accepts and round-trips the payload', async () => {
    const token = await mintToken({ roomId: 'genesis', perm: 'owner', name: 'Alex' }, SECRET)
    expect(await verifyToken(token, SECRET)).toEqual({ r: 'genesis', p: 'owner', n: 'Alex', v: 1 })
  })

  it('defaults perm to owner and omits name when absent', async () => {
    const token = await mintToken({ roomId: 'r1' }, SECRET)
    expect(await verifyToken(token, SECRET)).toEqual({ r: 'r1', p: 'owner', v: 1 })
  })

  it('honors view/edit perms', async () => {
    const token = await mintToken({ roomId: 'r1', perm: 'view' }, SECRET)
    expect(await verifyToken(token, SECRET)).toMatchObject({ p: 'view' })
  })

  it('is rejected when verified with the wrong secret', async () => {
    const token = await mintToken({ roomId: 'r1' }, SECRET)
    expect(await verifyToken(token, 'other-secret')).toBeNull()
  })

  it('throws on an empty roomId or missing secret', async () => {
    await expect(mintToken({ roomId: '' }, SECRET)).rejects.toThrow()
    await expect(mintToken({ roomId: 'r1' }, '')).rejects.toThrow()
  })

  it('throws on an unknown perm (would sign a dead link)', async () => {
    // Simulates the CLI casting a bad argv string (e.g. `mint-token r1 edt`).
    await expect(mintToken({ roomId: 'r1', perm: 'edt' as never }, SECRET)).rejects.toThrow(/invalid perm/)
  })
})

describe('parseDevVar', () => {
  it('extracts a key, ignoring comments and other keys', () => {
    const text = '# a comment\nLIVEBLOCKS_SECRET_KEY=sk_x\nTOKEN_SECRET = super-secret \n'
    expect(parseDevVar(text, 'TOKEN_SECRET')).toBe('super-secret')
    expect(parseDevVar(text, 'MISSING')).toBeUndefined()
  })
})
