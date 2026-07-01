import { describe, expect, it } from 'vitest'
import { formatDay, formatDayLong, formatTimeRange } from './dateFormat'

describe('formatDay', () => {
  it('renders a day key day-first as dd.MM', () => {
    expect(formatDay('2027-05-01')).toBe('01.05')
    expect(formatDay('2027-12-09')).toBe('09.12')
  })
})

describe('formatDayLong', () => {
  it('renders a day key day-first with the year as dd.MM.yyyy', () => {
    expect(formatDayLong('2027-05-01')).toBe('01.05.2027')
    expect(formatDayLong('2027-12-09')).toBe('09.12.2027')
  })
})

describe('formatTimeRange', () => {
  it('passes a single 24h time through unchanged', () => {
    expect(formatTimeRange('09:30')).toBe('09:30')
  })

  it('joins start and end with an en dash', () => {
    expect(formatTimeRange('09:30', '11:00')).toBe('09:30–11:00')
  })

  it('ignores an absent or empty end', () => {
    expect(formatTimeRange('14:00', '')).toBe('14:00')
    expect(formatTimeRange('14:00', undefined)).toBe('14:00')
  })
})
