import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import { freeTimelineSlots } from './timelineSlots'

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
  it('returns every available timed gap, including the tail of the day', () => {
    expect(freeTimelineSlots([card('08:00'), card('12:00', 2)], '06:00', '18:00')).toEqual([
      { startTime: '06:00', endTime: '08:00' },
      { startTime: '09:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '18:00' },
    ])
  })
})
