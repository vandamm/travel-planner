import { describe, expect, it } from 'vitest'
import type { Accommodation } from './schema'
import { accommodationCoversDay, resolveDayCity } from './cityResolution'

const stay = (over: Partial<Accommodation> = {}): Accommodation => ({
  id: 'a',
  label: 'Hotel',
  cityId: 'rome',
  startNight: '2027-05-01',
  endNight: '2027-05-03',
  ...over,
})

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
