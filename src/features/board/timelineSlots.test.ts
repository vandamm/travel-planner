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

  it('merges overlapping cards into one occupied span', () => {
    // 08:00–11:00 and 09:00–12:00 overlap; together they occupy 08:00–12:00,
    // so the free time is what sits either side of that union.
    expect(freeTimelineSlots([card('08:00', 3), card('09:00', 3)], '06:00', '14:00')).toEqual([
      { startTime: '06:00', endTime: '08:00' },
      { startTime: '12:00', endTime: '14:00' },
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

  it('counts a travel lead-in as occupied — free time must not offer the drive there', () => {
    // 09:00–11:00 with 45 min travel really occupies 08:15–11:00.
    expect(
      freeTimelineSlots([{ ...card('09:00', 2), travelMinutes: 45 }], '06:00', '14:00'),
    ).toEqual([
      { startTime: '06:00', endTime: '08:15' },
      { startTime: '11:00', endTime: '14:00' },
    ])
  })

  it('gives the lead-in`s time back when travel times are switched off', () => {
    expect(
      freeTimelineSlots([{ ...card('09:00', 2), travelMinutes: 45 }], '06:00', '14:00', false),
    ).toEqual([
      { startTime: '06:00', endTime: '09:00' },
      { startTime: '11:00', endTime: '14:00' },
    ])
  })

  it('clamps a lead-in that reaches back past the day window`s start', () => {
    // 06:30 with 60 min travel would start at 05:30; the window opens at 06:00.
    expect(
      freeTimelineSlots([{ ...card('06:30', 1), travelMinutes: 60 }], '06:00', '10:00'),
    ).toEqual([{ startTime: '07:30', endTime: '10:00' }])
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
      // 07:00 runs to 09:00, so 08:00 overlaps it — and still sits at 08:00.
      { id: '07:00', offsetMinutes: 60 },
      { id: '08:00', offsetMinutes: 120 },
      // The untimed card clears everything placed so far (07:00's 09:00 end).
      { id: 'untimed', offsetMinutes: 180 },
    ])
  })

  it('keeps a timed card at its clock position when an earlier card is stretched', () => {
    const at = (id: string, placements: ReturnType<typeof layoutTimelineCards>) =>
      placements.find((p) => p.card.id === id)?.offsetMinutes

    const before = layoutTimelineCards([card('10:00', 1), card('12:00', 1)], '06:00', '21:00')
    expect(at('12:00', before)).toBe(360)

    // Stretching 10:00 to three hours overlaps 12:00 — which must not move, or
    // the card would contradict the hour it displays.
    const after = layoutTimelineCards([card('10:00', 3), card('12:00', 1)], '06:00', '21:00')
    expect(at('12:00', after)).toBe(360)
  })

  it('reports the travel lead-in beside the offset, leaving the offset the true clock position', () => {
    const [placement] = layoutTimelineCards(
      [{ ...card('09:00', 3), travelMinutes: 45 }],
      '06:00',
      '21:00',
    )
    // The card still starts where the clock says; the band is what sits above it.
    expect(placement).toMatchObject({ offsetMinutes: 180, leadMinutes: 45 })
  })

  it('drops the lead-in when the trip is not showing travel times', () => {
    const [placement] = layoutTimelineCards(
      [{ ...card('09:00', 3), travelMinutes: 45 }],
      '06:00',
      '21:00',
      false,
    )
    expect(placement).toMatchObject({ offsetMinutes: 180, leadMinutes: 0 })
  })
})
