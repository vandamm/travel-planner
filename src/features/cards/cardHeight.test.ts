import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import {
  cardHeightPx,
  noonFraction,
  PX_PER_HOUR,
  resolvedDurationHours,
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

  it('keeps rendering when a persisted card has an invalid duration', () => {
    const corrupted = { ...card({}), duration: undefined } as unknown as Card
    expect(resolvedDurationHours(corrupted, START, END)).toBe(1)
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
