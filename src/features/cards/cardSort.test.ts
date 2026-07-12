import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import { isTimed, sortCardsForColumn } from './cardSort'

const card = (over: Partial<Card> & Pick<Card, 'id' | 'order'>): Card => ({
  dayKey: '2027-05-01',
  title: over.id,
  duration: 'custom',
  durationHours: 1,
  ...over,
})

describe('isTimed', () => {
  it('is true only when a non-empty startTime is present', () => {
    expect(isTimed(card({ id: 'a', order: 0, startTime: '08:00' }))).toBe(true)
    expect(isTimed(card({ id: 'b', order: 0 }))).toBe(false)
    expect(isTimed(card({ id: 'c', order: 0, startTime: '' }))).toBe(false)
  })
})

describe('sortCardsForColumn', () => {
  it('orders timed cards ahead of untimed ones', () => {
    const cards = [
      card({ id: 'untimed', order: 0 }),
      card({ id: 'timed', order: 9, startTime: '09:00' }),
    ]
    expect(sortCardsForColumn(cards).map((c) => c.id)).toEqual(['timed', 'untimed'])
  })

  it('sorts timed cards ascending by start time regardless of manual order', () => {
    const cards = [
      card({ id: 'evening', order: 0, startTime: '19:00' }),
      card({ id: 'morning', order: 1, startTime: '08:00' }),
      card({ id: 'noon', order: 2, startTime: '12:00' }),
    ]
    expect(sortCardsForColumn(cards).map((c) => c.id)).toEqual(['morning', 'noon', 'evening'])
  })

  it('sorts untimed cards by their manual order', () => {
    const cards = [
      card({ id: 'third', order: 2 }),
      card({ id: 'first', order: 0 }),
      card({ id: 'second', order: 1 }),
    ]
    expect(sortCardsForColumn(cards).map((c) => c.id)).toEqual(['first', 'second', 'third'])
  })

  it('interleaves a scrambled mix: timed by time, then untimed by order', () => {
    const cards = [
      card({ id: 'A', order: 0 }), // untimed, first
      card({ id: 'B', order: 5, startTime: '08:00' }), // timed, earliest
      card({ id: 'C', order: 1, startTime: '19:00' }), // timed, latest
      card({ id: 'D', order: 2 }), // untimed, second
    ]
    expect(sortCardsForColumn(cards).map((c) => c.id)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('breaks ties between equal start times by manual order', () => {
    const cards = [
      card({ id: 'late-order', order: 5, startTime: '08:00' }),
      card({ id: 'early-order', order: 1, startTime: '08:00' }),
    ]
    expect(sortCardsForColumn(cards).map((c) => c.id)).toEqual(['early-order', 'late-order'])
  })

  it('breaks ties between equal-order untimed cards by id for a stable order', () => {
    const cards = [card({ id: 'b', order: 0 }), card({ id: 'a', order: 0 }), card({ id: 'c', order: 0 })]
    expect(sortCardsForColumn(cards).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('breaks ties between timed cards with equal start time and order by id', () => {
    const cards = [
      card({ id: 'b', order: 0, startTime: '08:00' }),
      card({ id: 'a', order: 0, startTime: '08:00' }),
    ]
    expect(sortCardsForColumn(cards).map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('orders by start time regardless of duration', () => {
    const cards = [
      card({ id: 'short-late', order: 0, startTime: '10:00', durationHours: 0.5 }),
      card({ id: 'long-early', order: 1, startTime: '09:00', duration: 'day', durationHours: undefined }),
    ]
    expect(sortCardsForColumn(cards).map((c) => c.id)).toEqual(['long-early', 'short-late'])
  })

  it('does not mutate the input array', () => {
    const cards = [
      card({ id: 'A', order: 0 }),
      card({ id: 'B', order: 5, startTime: '08:00' }),
    ]
    sortCardsForColumn(cards)
    expect(cards.map((c) => c.id)).toEqual(['A', 'B'])
  })

  it('returns an empty array unchanged', () => {
    expect(sortCardsForColumn([])).toEqual([])
  })
})
