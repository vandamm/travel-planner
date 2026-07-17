import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import {
  cardHeightPx,
  hoursToMinutes,
  MIN_CARD_MINUTES,
  minutesToHours,
  noonFraction,
  PX_PER_HOUR,
  resolvedDurationHours,
  SNAP_MINUTES,
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

describe('cardHeightPx — duration', () => {
  it('uses a one-pixel-per-minute scale', () => {
    expect(PX_PER_HOUR).toBe(60)
  })

  it('uses the configured day window for a day duration', () => {
    expect(cardHeightPx(card({ duration: 'day' }), START, END)).toBe(15 * PX_PER_HOUR)
  })

  it('uses half the configured day window for a half-day duration', () => {
    // 15h window → 7.5h.
    expect(cardHeightPx(card({ duration: 'half' }), START, END)).toBe(7.5 * PX_PER_HOUR)
  })

  it('uses custom durationHours', () => {
    expect(cardHeightPx(card({ duration: 'custom', durationHours: 2 }), START, END)).toBe(
      2 * PX_PER_HOUR,
    )
  })

  it('keeps a quarter-hour custom duration', () => {
    const quarterHour = card({ duration: 'custom', durationHours: 0.25 })
    expect(resolvedDurationHours(quarterHour, START, END)).toBe(0.25)
    expect(cardHeightPx(quarterHour, START, END)).toBe(15)
  })

  it('uses shared quarter-hour minute conversions', () => {
    expect(SNAP_MINUTES).toBe(15)
    expect(MIN_CARD_MINUTES).toBe(15)
    expect(hoursToMinutes(0.25)).toBe(15)
    expect(minutesToHours(15)).toBe(0.25)
  })
})

describe('noonFraction', () => {
  it('is the noon position within the window (06:00–21:00 → 6/15)', () => {
    expect(noonFraction(START, END)).toBeCloseTo(6 / 15)
  })

  it('clamps to 0 when noon precedes the window start', () => {
    expect(noonFraction('13:00', '21:00')).toBe(0)
  })

  it('clamps to 1 when noon follows the window end', () => {
    expect(noonFraction('06:00', '11:00')).toBe(1)
  })

  it('falls back to the middle for a non-positive window', () => {
    expect(noonFraction('21:00', '06:00')).toBe(0.5)
  })
})
