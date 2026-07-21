import { describe, expect, it } from 'vitest'
import type { Accommodation, Day } from './schema'
import {
  accommodationCoversDay,
  firstUncoveredDay,
  resolveDayCity,
  uncoveredDays,
  uncoveredGaps,
} from './cityResolution'

const stay = (over: Partial<Accommodation> = {}): Accommodation => ({
  id: 'a',
  label: 'Hotel',
  cityId: 'rome',
  startNight: '2027-05-01',
  endNight: '2027-05-03',
  ...over,
})

// Days D1..Dn starting 2027-05-01.
const days = (n: number): Day[] =>
  Array.from({ length: n }, (_, index) => ({
    key: `2027-05-${String(index + 1).padStart(2, '0')}`,
    index,
  }))

describe('accommodationCoversDay', () => {
  it('covers the inclusive night span and nothing outside it', () => {
    const a = stay()
    expect(accommodationCoversDay(a, '2027-05-01')).toBe(true)
    expect(accommodationCoversDay(a, '2027-05-02')).toBe(true)
    expect(accommodationCoversDay(a, '2027-05-03')).toBe(true)
    expect(accommodationCoversDay(a, '2027-04-30')).toBe(false)
    expect(accommodationCoversDay(a, '2027-05-04')).toBe(false)
  })
})

describe('resolveDayCity', () => {
  it('derives the city from a covering accommodation', () => {
    const accs = [stay({ cityId: 'rome' })]
    expect(resolveDayCity('2027-05-02', accs, {})).toBe('rome')
  })

  it('returns undefined on a travel day with no covering accommodation', () => {
    const accs = [stay({ startNight: '2027-05-01', endNight: '2027-05-02', cityId: 'rome' })]
    expect(resolveDayCity('2027-05-03', accs, {})).toBeUndefined()
  })

  it('returns undefined when there are no accommodations', () => {
    expect(resolveDayCity('2027-05-02', [], {})).toBeUndefined()
  })

  it('lets a per-day override win over the covering accommodation', () => {
    const accs = [stay({ cityId: 'rome' })]
    expect(resolveDayCity('2027-05-02', accs, { '2027-05-02': 'florence' })).toBe('florence')
  })

  it('lets an explicit no-city override block accommodation inheritance', () => {
    const accs = [stay({ cityId: 'rome' })]
    expect(resolveDayCity('2027-05-02', accs, { '2027-05-02': null })).toBeUndefined()
  })

  it('applies an override even on a day with no accommodation', () => {
    expect(resolveDayCity('2027-05-09', [], { '2027-05-09': 'venice' })).toBe('venice')
  })

  it('ignores accommodations that have no cityId', () => {
    const accs = [stay({ cityId: undefined })]
    expect(resolveDayCity('2027-05-02', accs, {})).toBeUndefined()
  })

  it('prefers the latest check-in when stays overlap', () => {
    const accs = [
      stay({ id: 'a', cityId: 'rome', startNight: '2027-05-01', endNight: '2027-05-04' }),
      stay({ id: 'b', cityId: 'florence', startNight: '2027-05-03', endNight: '2027-05-06' }),
    ]
    expect(resolveDayCity('2027-05-03', accs, {})).toBe('florence')
    expect(resolveDayCity('2027-05-02', accs, {})).toBe('rome')
  })

  it('treats an empty overrides argument as optional', () => {
    const accs = [stay({ cityId: 'rome' })]
    expect(resolveDayCity('2027-05-02', accs)).toBe('rome')
  })
})

describe('uncoveredDays', () => {
  it('returns every day when there are no stays', () => {
    expect(uncoveredDays(days(3), [])).toEqual(['2027-05-01', '2027-05-02', '2027-05-03'])
  })

  it('returns none when every day is covered', () => {
    const accs = [stay({ startNight: '2027-05-01', endNight: '2027-05-03' })]
    expect(uncoveredDays(days(3), accs)).toEqual([])
  })

  it('finds a leading gap', () => {
    const accs = [stay({ startNight: '2027-05-03', endNight: '2027-05-04' })]
    expect(uncoveredDays(days(4), accs)).toEqual(['2027-05-01', '2027-05-02'])
  })

  it('finds a middle gap', () => {
    const accs = [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-01' }),
      stay({ id: 'b', startNight: '2027-05-04', endNight: '2027-05-05' }),
    ]
    expect(uncoveredDays(days(5), accs)).toEqual(['2027-05-02', '2027-05-03'])
  })

  it('finds a trailing gap', () => {
    const accs = [stay({ startNight: '2027-05-01', endNight: '2027-05-02' })]
    expect(uncoveredDays(days(4), accs)).toEqual(['2027-05-03', '2027-05-04'])
  })

  it('counts a stay with no cityId as coverage', () => {
    const accs = [stay({ cityId: undefined, startNight: '2027-05-01', endNight: '2027-05-03' })]
    expect(uncoveredDays(days(3), accs)).toEqual([])
  })
})

describe('firstUncoveredDay', () => {
  it('returns undefined when all days are covered', () => {
    const accs = [stay({ startNight: '2027-05-01', endNight: '2027-05-03' })]
    expect(firstUncoveredDay(days(3), accs)).toBeUndefined()
  })

  it('returns the first day when there are no stays', () => {
    expect(firstUncoveredDay(days(3), [])).toBe('2027-05-01')
  })

  it('returns the first uncovered day past a leading stay', () => {
    const accs = [stay({ startNight: '2027-05-01', endNight: '2027-05-02' })]
    expect(firstUncoveredDay(days(4), accs)).toBe('2027-05-03')
  })
})

describe('uncoveredGaps', () => {
  it('groups contiguous uncovered days into ranges', () => {
    const accs = [
      stay({ id: 'a', startNight: '2027-05-02', endNight: '2027-05-02' }),
      stay({ id: 'b', startNight: '2027-05-05', endNight: '2027-05-05' }),
    ]
    // covered: D2, D5 → gaps: [D1], [D3,D4], [D6,D7]
    expect(uncoveredGaps(days(7), accs)).toEqual([
      ['2027-05-01'],
      ['2027-05-03', '2027-05-04'],
      ['2027-05-06', '2027-05-07'],
    ])
  })

  it('returns one range covering everything when there are no stays', () => {
    expect(uncoveredGaps(days(2), [])).toEqual([['2027-05-01', '2027-05-02']])
  })

  it('returns no ranges when adjacent stays leave no gap', () => {
    const accs = [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-02' }),
      stay({ id: 'b', startNight: '2027-05-03', endNight: '2027-05-04' }),
    ]
    expect(uncoveredGaps(days(4), accs)).toEqual([])
  })
})
