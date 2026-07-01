import { describe, expect, it } from 'vitest'
import { inRange, isEndpoint, monthGrid, nextRange } from './calendar'

describe('monthGrid', () => {
  it('lays out full Sunday-first weeks of 7 days', () => {
    const weeks = monthGrid(2027, 4) // May 2027
    expect(weeks.length).toBeGreaterThanOrEqual(4)
    for (const week of weeks) expect(week).toHaveLength(7)
    // Every week starts on a Sunday (JS getDay 0) — check via the ISO key.
    for (const week of weeks) {
      expect(new Date(`${week[0].key}T00:00`).getDay()).toBe(0)
    }
  })

  it('marks leading/trailing adjacent-month days as out-of-month', () => {
    // May 1 2027 is a Saturday, so the first row is Apr 25–May 1: six filler days.
    const weeks = monthGrid(2027, 4)
    const first = weeks[0]
    expect(first.filter((d) => !d.inMonth)).toHaveLength(6)
    expect(first[6]).toMatchObject({ key: '2027-05-01', dayOfMonth: 1, inMonth: true })
  })

  it('covers every day of the month exactly once', () => {
    const keys = monthGrid(2027, 4)
      .flat()
      .filter((d) => d.inMonth)
      .map((d) => d.key)
    expect(keys[0]).toBe('2027-05-01')
    expect(keys.at(-1)).toBe('2027-05-31')
    expect(keys).toHaveLength(31)
  })

  it('handles leap-year February (29 days)', () => {
    const feb = monthGrid(2028, 1) // Feb 2028 is a leap year
    const inMonth = feb.flat().filter((d) => d.inMonth)
    expect(inMonth).toHaveLength(29)
    expect(inMonth.at(-1)?.key).toBe('2028-02-29')
  })

  it('handles a non-leap February (28 days)', () => {
    const feb = monthGrid(2027, 1)
    expect(feb.flat().filter((d) => d.inMonth)).toHaveLength(28)
  })

  it('rolls the year at December and January boundaries', () => {
    const dec = monthGrid(2027, 11).flat().filter((d) => d.inMonth)
    expect(dec[0].key).toBe('2027-12-01')
    expect(dec.at(-1)?.key).toBe('2027-12-31')
    const jan = monthGrid(2027, 0).flat().filter((d) => d.inMonth)
    expect(jan[0].key).toBe('2027-01-01')
  })
})

describe('nextRange', () => {
  it('picks the anchor on the first click', () => {
    expect(nextRange({}, '2027-05-03')).toEqual({ start: '2027-05-03', end: undefined })
  })

  it('completes the range on a later second click', () => {
    expect(nextRange({ start: '2027-05-03' }, '2027-05-07')).toEqual({
      start: '2027-05-03',
      end: '2027-05-07',
    })
  })

  it('swaps when the second click is before the anchor (last-before-first)', () => {
    expect(nextRange({ start: '2027-05-07' }, '2027-05-03')).toEqual({
      start: '2027-05-03',
      end: '2027-05-07',
    })
  })

  it('allows a single-day range (same day twice)', () => {
    expect(nextRange({ start: '2027-05-03' }, '2027-05-03')).toEqual({
      start: '2027-05-03',
      end: '2027-05-03',
    })
  })

  it('starts a fresh selection once a range is complete', () => {
    const complete = { start: '2027-05-03', end: '2027-05-07' }
    expect(nextRange(complete, '2027-05-10')).toEqual({ start: '2027-05-10', end: undefined })
  })
})

describe('inRange / isEndpoint', () => {
  const range = { start: '2027-05-03', end: '2027-05-07' }

  it('includes both endpoints and days between', () => {
    expect(inRange(range, '2027-05-03')).toBe(true)
    expect(inRange(range, '2027-05-05')).toBe(true)
    expect(inRange(range, '2027-05-07')).toBe(true)
    expect(inRange(range, '2027-05-08')).toBe(false)
    expect(inRange(range, '2027-05-02')).toBe(false)
  })

  it('reports nothing in range while the selection is incomplete', () => {
    expect(inRange({ start: '2027-05-03' }, '2027-05-03')).toBe(false)
  })

  it('flags only the endpoints', () => {
    expect(isEndpoint(range, '2027-05-03')).toBe(true)
    expect(isEndpoint(range, '2027-05-07')).toBe(true)
    expect(isEndpoint(range, '2027-05-05')).toBe(false)
  })
})
