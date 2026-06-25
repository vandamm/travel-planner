import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import {
  DEFAULT_DIRECTION,
  TIME_DIRECTION_KEY,
  canonicalCardOrder,
  loadTimeDirection,
  orderCardsForDirection,
  saveTimeDirection,
  toggleDirection,
} from './timeDirection'

/** A throwaway in-memory Storage so tests never touch the real localStorage. */
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}

const card = (over: Partial<Card> & Pick<Card, 'id' | 'order'>): Card => ({
  dayKey: '2027-05-01',
  title: over.id,
  ...over,
})

// A deliberately scrambled mix of timed and untimed cards.
const A = card({ id: 'A', order: 0 }) // untimed, first by manual order
const B = card({ id: 'B', order: 5, startTime: '08:00' }) // timed, earliest
const C = card({ id: 'C', order: 1, startTime: '19:00' }) // timed, latest
const D = card({ id: 'D', order: 2 }) // untimed, second by manual order
const MIX = [A, B, C, D]

describe('time-direction preference', () => {
  it('defaults to morning→evening (down)', () => {
    expect(DEFAULT_DIRECTION).toBe('down')
    expect(loadTimeDirection(memoryStorage())).toBe('down')
  })

  it('round-trips through storage', () => {
    const storage = memoryStorage()
    saveTimeDirection('up', storage)
    expect(storage.getItem(TIME_DIRECTION_KEY)).toBe('up')
    expect(loadTimeDirection(storage)).toBe('up')
  })

  it('falls back to the default for a missing or junk value', () => {
    const storage = memoryStorage()
    expect(loadTimeDirection(storage)).toBe('down')
    storage.setItem(TIME_DIRECTION_KEY, 'sideways')
    expect(loadTimeDirection(storage)).toBe('down')
  })

  it('toggles between the two directions', () => {
    expect(toggleDirection('down')).toBe('up')
    expect(toggleDirection('up')).toBe('down')
  })
})

describe('canonicalCardOrder', () => {
  it('puts timed cards first in time order, then untimed by manual order', () => {
    expect(canonicalCardOrder(MIX).map((c) => c.id)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('does not mutate the input array', () => {
    const input = [...MIX]
    canonicalCardOrder(input)
    expect(input.map((c) => c.id)).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('orderCardsForDirection', () => {
  it('keeps the canonical (morning→evening) order when direction is down', () => {
    expect(orderCardsForDirection(MIX, 'down').map((c) => c.id)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('reverses every card uniformly when direction is up', () => {
    expect(orderCardsForDirection(MIX, 'up').map((c) => c.id)).toEqual(['D', 'A', 'C', 'B'])
  })

  it('is the exact reverse of the down order across timed + untimed cards', () => {
    const down = orderCardsForDirection(MIX, 'down').map((c) => c.id)
    const up = orderCardsForDirection(MIX, 'up').map((c) => c.id)
    expect(up).toEqual([...down].reverse())
  })

  it('does not mutate the input array', () => {
    const input = [...MIX]
    orderCardsForDirection(input, 'up')
    expect(input.map((c) => c.id)).toEqual(['A', 'B', 'C', 'D'])
  })
})
