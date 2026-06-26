import { describe, expect, it } from 'vitest'
import { generateDays, MAX_TRIP_DAYS } from './days'

describe('generateDays', () => {
  it('returns an empty list for zero or negative day counts', () => {
    expect(generateDays('2027-05-01', 0)).toEqual([])
    expect(generateDays('2027-05-01', -3)).toEqual([])
  })

  it('returns an empty list when no start date is set', () => {
    expect(generateDays('', 5)).toEqual([])
  })

  it('produces consecutive day keys with 0-based indexes', () => {
    expect(generateDays('2027-05-01', 3)).toEqual([
      { key: '2027-05-01', index: 0 },
      { key: '2027-05-02', index: 1 },
      { key: '2027-05-03', index: 2 },
    ])
  })

  it('includes both the first and last day (inclusive count)', () => {
    const days = generateDays('2027-05-01', 1)
    expect(days).toEqual([{ key: '2027-05-01', index: 0 }])
  })

  it('crosses month boundaries', () => {
    const days = generateDays('2027-05-30', 3)
    expect(days.map((d) => d.key)).toEqual(['2027-05-30', '2027-05-31', '2027-06-01'])
  })

  it('crosses a leap-year February boundary', () => {
    const days = generateDays('2028-02-28', 3)
    expect(days.map((d) => d.key)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01'])
  })

  it('crosses a year boundary', () => {
    const days = generateDays('2027-12-31', 2)
    expect(days.map((d) => d.key)).toEqual(['2027-12-31', '2028-01-01'])
  })

  it('clamps a pathological day count to the maximum to bound the board', () => {
    const days = generateDays('2027-05-01', 100_000_000)
    expect(days).toHaveLength(MAX_TRIP_DAYS)
    expect(days[0]).toEqual({ key: '2027-05-01', index: 0 })
    expect(days[days.length - 1].index).toBe(MAX_TRIP_DAYS - 1)
  })
})
