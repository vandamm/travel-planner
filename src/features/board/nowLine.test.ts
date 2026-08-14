import { describe, expect, it } from 'vitest'
import type { Day } from '../../data/schema'
import { MIN_PX_PER_HOUR } from '../cards/cardHeight'
import { localClock, nowLine, nowOffsetPx } from './nowLine'

const days: Day[] = [
  { key: '2027-05-01', index: 0 },
  { key: '2027-05-02', index: 1 },
]

describe('localClock', () => {
  it('formats a Date as a zero-padded HH:mm', () => {
    expect(localClock(new Date(2027, 4, 1, 9, 5))).toBe('09:05')
    expect(localClock(new Date(2027, 4, 1, 14, 30))).toBe('14:30')
  })
})

describe('nowOffsetPx', () => {
  it('maps the time of day onto the window scale', () => {
    expect(nowOffsetPx('06:00', '06:00', '21:00')).toBe(0)
    expect(nowOffsetPx('14:30', '06:00', '21:00')).toBe(8.5 * MIN_PX_PER_HOUR)
    expect(nowOffsetPx('21:00', '06:00', '21:00')).toBe(15 * MIN_PX_PER_HOUR)
  })

  it('is null outside the window, so no line is drawn', () => {
    expect(nowOffsetPx('05:59', '06:00', '21:00')).toBeNull()
    expect(nowOffsetPx('21:01', '06:00', '21:00')).toBeNull()
  })
})

describe('nowLine', () => {
  it('draws only when today is one of the visible days', () => {
    expect(nowLine(days, '2027-05-02', '14:30', '06:00', '21:00')).toEqual({
      offsetPx: 8.5 * MIN_PX_PER_HOUR,
      clock: '14:30',
    })
    expect(nowLine(days, '2027-06-01', '14:30', '06:00', '21:00')).toBeNull()
  })

  it('stays off when today is visible but now is outside the window', () => {
    expect(nowLine(days, '2027-05-01', '23:30', '06:00', '21:00')).toBeNull()
  })
})
