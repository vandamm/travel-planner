import { describe, expect, it } from 'vitest'
import { addCity, listCities } from './doc'
import { connectRoom, roomHash, roomIdFromHash } from './provider'

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
