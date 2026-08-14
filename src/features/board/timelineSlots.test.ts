import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import { freeTimelineSlots, layoutTimelineCards } from './timelineSlots'

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

  it('removes time occupied by cards shifted below an earlier overlap', () => {
    expect(freeTimelineSlots([card('08:00', 3), card('09:00', 3)], '06:00', '14:00')).toEqual([
      { startTime: '06:00', endTime: '08:00' },
    ])
  })

  it('subtracts untimed cards from free time at their calculated stacked positions', () => {
    const cards: Card[] = [
      card('07:00', 2),
      { ...card('', 1), id: 'untimed', startTime: undefined, order: 1 },
      { ...card('12:00', 1), order: 2 },
      { ...card('', 2), id: 'untimed-2', startTime: undefined, order: 3 },
    ]

    expect(freeTimelineSlots(cards, '06:00', '18:00')).toEqual([
      { startTime: '06:00', endTime: '07:00' },
      { startTime: '10:00', endTime: '12:00' },
      { startTime: '15:00', endTime: '18:00' },
    ])
  })
})

describe('layoutTimelineCards', () => {
  it('places untimed cards directly after the preceding rendered card', () => {
    const cards: Card[] = [
      card('07:00', 2),
      { ...card('08:00', 1), order: 1 },
      { ...card('', 1), id: 'untimed', startTime: undefined, order: 2 },
    ]

    expect(
      layoutTimelineCards(cards, '06:00', '18:00').map(({ card, offsetMinutes }) => ({
        id: card.id,
        offsetMinutes,
      })),
    ).toEqual([
      { id: '07:00', offsetMinutes: 60 },
      { id: '08:00', offsetMinutes: 180 },
      { id: 'untimed', offsetMinutes: 240 },
    ])
  })
})
