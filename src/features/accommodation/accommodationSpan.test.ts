import { describe, expect, it } from 'vitest'
import { generateDays } from '../../data/days'
import type { Accommodation } from '../../data/schema'
import { accommodationColumnSpan, packAccommodations } from './accommodationSpan'

const days = generateDays('2027-05-01', 5) // 05-01 … 05-05

const stay = (over: Partial<Accommodation> = {}): Accommodation => ({
  id: 'a',
  label: 'Hotel',
  cityId: 'rome',
  startNight: '2027-05-01',
  endNight: '2027-05-02',
  ...over,
})

describe('accommodationColumnSpan', () => {
  it('spans the columns whose nights the stay covers', () => {
    const span = accommodationColumnSpan(days, stay({ startNight: '2027-05-02', endNight: '2027-05-04' }))
    expect(span).toEqual({ startIndex: 1, span: 3, clippedStart: false, clippedEnd: false })
  })

  it('covers a single column for a one-night stay', () => {
    const span = accommodationColumnSpan(days, stay({ startNight: '2027-05-03', endNight: '2027-05-03' }))
    expect(span).toMatchObject({ startIndex: 2, span: 1 })
  })

  it('returns null for a stay entirely outside the visible days', () => {
    expect(accommodationColumnSpan(days, stay({ startNight: '2027-06-01', endNight: '2027-06-03' }))).toBeNull()
    expect(accommodationColumnSpan(days, stay({ startNight: '2027-04-01', endNight: '2027-04-03' }))).toBeNull()
  })

  it('clamps to the visible range and flags clipping at both ends', () => {
    const span = accommodationColumnSpan(days, stay({ startNight: '2027-04-29', endNight: '2027-05-09' }))
    expect(span).toEqual({ startIndex: 0, span: 5, clippedStart: true, clippedEnd: true })
  })

  it('returns null when there are no days', () => {
    expect(accommodationColumnSpan([], stay())).toBeNull()
  })
})

describe('packAccommodations', () => {
  it('keeps non-overlapping stays on a single row', () => {
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-02' }),
      stay({ id: 'b', startNight: '2027-05-03', endNight: '2027-05-04' }),
    ])
    expect(placed.map((p) => [p.accommodation.id, p.row])).toEqual([
      ['a', 0],
      ['b', 0],
    ])
  })

  it('stacks overlapping stays onto separate rows', () => {
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-03' }),
      stay({ id: 'b', startNight: '2027-05-03', endNight: '2027-05-04' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p.row]))
    expect(byId.a).toBe(0)
    expect(byId.b).toBe(1)
  })

  it('drops stays that fall outside the visible days', () => {
    const placed = packAccommodations(days, [stay({ id: 'x', startNight: '2030-01-01', endNight: '2030-01-02' })])
    expect(placed).toEqual([])
  })
})
