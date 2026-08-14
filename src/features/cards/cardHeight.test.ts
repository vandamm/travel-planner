import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import {
  cardHeightPx,
  hoursToMinutes,
  MIN_CARD_MINUTES,
  minutesToHours,
  MIN_PX_PER_HOUR,
  resolvedDurationHours,
  SNAP_MINUTES,
  fitPxPerHour,
  hourMarkAlignment,
} from './cardHeight'

const card = (over: Partial<Card>): Card => ({
  id: 'c',
  dayKey: '2027-05-01',
  title: 'c',
  order: 0,
  duration: 'custom',
  durationHours: 1,
  ...over,
})

// A 15-hour window (06:00–21:00), the default trip day.
const START = '06:00'
const END = '21:00'

describe('hourMarkAlignment', () => {
  it('centres a label on its rail inside the track', () => {
    expect(hourMarkAlignment(200, 700)).toBe('center')
  })

  it('tucks the first and last labels inside, not astride the edge', () => {
    // Centred there, half the label would sit outside the grid — under the
    // footer at the bottom, clipped away at the top.
    expect(hourMarkAlignment(0, 700)).toBe('start')
    expect(hourMarkAlignment(700, 700)).toBe('end')
    // A window ending on an odd hour has no rail on the edge at all.
    expect(hourMarkAlignment(650, 700)).toBe('center')
  })
})

describe('fitPxPerHour', () => {
  it('stretches an hour so the day fills the height it is given', () => {
    // A 15-hour day in 1200px of board → 80px an hour.
    expect(fitPxPerHour(1200, 15)).toBe(80)
    expect(fitPxPerHour(900, 15)).toBe(60)
  })

  it('never squeezes below the floor — the board scrolls instead', () => {
    // 15h would need 40px/h to fit 600px; the floor wins and the day overflows.
    expect(fitPxPerHour(600, 15)).toBe(MIN_PX_PER_HOUR)
    expect(fitPxPerHour(0, 15)).toBe(MIN_PX_PER_HOUR)
    expect(fitPxPerHour(-100, 15)).toBe(MIN_PX_PER_HOUR)
  })

  it('floors to a whole pixel so rails and card edges stay aligned', () => {
    expect(Number.isInteger(fitPxPerHour(1000, 13))).toBe(true)
    expect(fitPxPerHour(1000, 13)).toBe(76)
  })

  it('falls back to the floor when the measurement is not usable yet', () => {
    expect(fitPxPerHour(Number.NaN, 15)).toBe(MIN_PX_PER_HOUR)
    expect(fitPxPerHour(1200, 0)).toBe(MIN_PX_PER_HOUR)
  })
})

describe('cardHeightPx — duration', () => {
  it('floors the scale at 50px per hour', () => {
    expect(MIN_PX_PER_HOUR).toBe(50)
  })

  it('uses the configured day window for a day duration', () => {
    expect(cardHeightPx(card({ duration: 'day' }), START, END)).toBe(15 * MIN_PX_PER_HOUR)
  })

  it('uses half the configured day window for a half-day duration', () => {
    // 15h window → 7.5h.
    expect(cardHeightPx(card({ duration: 'half' }), START, END)).toBe(7.5 * MIN_PX_PER_HOUR)
  })

  it('uses custom durationHours', () => {
    expect(cardHeightPx(card({ duration: 'custom', durationHours: 2 }), START, END)).toBe(
      2 * MIN_PX_PER_HOUR,
    )
  })

  it('keeps a quarter-hour custom duration', () => {
    const quarterHour = card({ duration: 'custom', durationHours: 0.25 })
    expect(resolvedDurationHours(quarterHour, START, END)).toBe(0.25)
    expect(cardHeightPx(quarterHour, START, END)).toBe(MIN_PX_PER_HOUR / 4)
  })

  it('keeps a legacy non-quarter custom duration for rendering', () => {
    const legacy = card({ duration: 'custom', durationHours: 1.1 })
    expect(resolvedDurationHours(legacy, START, END)).toBe(1.1)
  })

  it('uses shared quarter-hour minute conversions', () => {
    expect(SNAP_MINUTES).toBe(15)
    expect(MIN_CARD_MINUTES).toBe(15)
    expect(hoursToMinutes(0.25)).toBe(15)
    expect(minutesToHours(15)).toBe(0.25)
  })
})
