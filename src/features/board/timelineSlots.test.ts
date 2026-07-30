import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import { formatFreeDuration, freeTimelineSlots } from './timelineSlots'

const card = (startTime: string, hours = 1): Card => ({
  id: startTime,
  dayKey: '2027-05-01',
  title: startTime,
  startTime,
  order: 0,
  duration: 'custom',
  durationHours: hours,
})

describe('freeTimelineSlots', () => {
  it('returns each available interval around timed activities', () => {
    expect(freeTimelineSlots([card('08:00'), card('12:00', 2)], '06:00', '18:00')).toEqual([
      { startTime: '06:00', endTime: '08:00' },
      { startTime: '09:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '18:00' },
    ])
  })

  it('merges overlapping occupied intervals before finding free time', () => {
    expect(freeTimelineSlots([card('08:00', 3), card('09:00', 3)], '06:00', '14:00')).toEqual([
      { startTime: '06:00', endTime: '08:00' },
      { startTime: '12:00', endTime: '14:00' },
    ])
  })
})

describe('formatFreeDuration', () => {
  it.each([
    ['06:00', '10:00', '4 hours free'],
    ['12:00', '17:15', '5h 15m free'],
    ['20:00', '21:00', '1 hour free'],
  ])('formats %s to %s as %s', (start, end, expected) => {
    expect(formatFreeDuration(start, end)).toBe(expected)
  })
})
