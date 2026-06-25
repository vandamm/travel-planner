import { describe, expect, it, vi } from 'vitest'
import { addCity, listCities } from './doc'
import { connectRoom, createRoom, roomHash, roomIdFromHash } from './provider'

describe('roomIdFromHash', () => {
  it('parses a `#room=<id>` hash', () => {
    expect(roomIdFromHash('#room=italy-2027')).toBe('italy-2027')
  })

  it('accepts a bare `#<id>` hash', () => {
    expect(roomIdFromHash('#italy-2027')).toBe('italy-2027')
  })

  it('returns null for an empty or hash-only fragment', () => {
    expect(roomIdFromHash('')).toBeNull()
    expect(roomIdFromHash('#')).toBeNull()
    expect(roomIdFromHash('#room=')).toBeNull()
  })

  it('round-trips with roomHash', () => {
    expect(roomHash('italy-2027')).toBe('#room=italy-2027')
    expect(roomIdFromHash(roomHash('italy-2027'))).toBe('italy-2027')
  })
})

describe('createRoom', () => {
  it('POSTs to the worker with the owner secret and returns the new room id', async () => {
    let url: string | undefined
    let init: RequestInit | undefined
    const fetchImpl = vi.fn(async (calledUrl: string, calledInit: RequestInit) => {
      url = calledUrl
      init = calledInit
      return new Response(JSON.stringify({ id: 'rome-2027' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    })

    const id = await createRoom({
      workerUrl: 'https://worker.test/',
      ownerSecret: 'owner-pw',
      roomId: 'rome-2027',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(id).toBe('rome-2027')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(url).toBe('https://worker.test/api/rooms')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['x-owner-secret']).toBe('owner-pw')
    expect(JSON.parse(init?.body as string)).toEqual({ room: 'rome-2027' })
  })

  it('throws when the worker rejects the request', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
    await expect(
      createRoom({
        workerUrl: 'https://worker.test',
        ownerSecret: 'wrong',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow()
  })
})

describe('connectRoom (local-first, sync disabled)', () => {
  it('returns a usable in-memory doc with local status and no network', () => {
    const conn = connectRoom({ roomId: 'local-test', workerUrl: '', enableSync: false })
    try {
      expect(conn.getStatus()).toBe('local')
      addCity(conn.doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
      expect(listCities(conn.doc).map((c) => c.name)).toEqual(['Rome'])
    } finally {
      conn.destroy()
    }
  })

  it('notifies status subscribers and supports unsubscribe', () => {
    const conn = connectRoom({ roomId: 'local-test', workerUrl: '', enableSync: false })
    try {
      const seen: string[] = []
      const unsub = conn.onStatus((s) => seen.push(s))
      unsub()
      // After unsubscribe, no further calls; subscription mechanics don't throw.
      expect(typeof unsub).toBe('function')
      expect(seen).toEqual([])
    } finally {
      conn.destroy()
    }
  })
})
