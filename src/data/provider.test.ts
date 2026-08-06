import { describe, expect, it } from 'vitest'
import { addCity, listCities } from './doc'
import { connectRoom } from './provider'

describe('connectRoom (local-first, sync disabled)', () => {
  it('returns a usable in-memory doc with local status and no network', () => {
    const conn = connectRoom({ roomId: 'local-test', workerUrl: '', enableSync: false })
    try {
      expect(conn.getStatus()).toBe('local')
      expect(typeof conn.updatePresence).toBe('function')
      expect(() => conn.updatePresence({ name: 'Anna' })).not.toThrow()
      addCity(conn.doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
      expect(listCities(conn.doc).map((c) => c.name)).toEqual(['Rome'])
    } finally {
      conn.destroy()
    }
  })

  it('does not fire subscribers on subscribe (status is pull-based) and unsubscribe returns a function', () => {
    const conn = connectRoom({ roomId: 'local-test', workerUrl: '', enableSync: false })
    try {
      const seen: string[] = []
      const unsub = conn.onStatus((s) => seen.push(s))
      // Subscribing must not synchronously emit; with sync disabled there is no
      // transition to deliver, so the callback stays untouched. (Delivery on a
      // real status change is covered by the live sync path, not this unit test.)
      expect(seen).toEqual([])
      expect(typeof unsub).toBe('function')
      unsub()
    } finally {
      conn.destroy()
    }
  })
})
