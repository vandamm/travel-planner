import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import {
  cardHeightPx,
  DEFAULT_CARD_HOURS,
  noonFraction,
  PX_PER_HOUR,
  windowHeightPx,
} from './cardHeight'

const card = (over: Partial<Card>): Card => ({
  id: 'c',
  dayKey: '2027-05-01',
  title: 'c',
  order: 0,
  ...over,
})

// A 15-hour window (06:00–21:00), the default trip day.
const START = '06:00'
const END = '21:00'

describe('cardHeightPx — auto (default / absent size)', () => {
  it('gives an untimed card the default 1-hour block', () => {
    expect(cardHeightPx(card({}), START, END)).toBe(DEFAULT_CARD_HOURS * PX_PER_HOUR)
  })

  it('scales a timed card by its duration', () => {
    expect(cardHeightPx(card({ startTime: '10:00', endTime: '12:00' }), START, END)).toBe(
      2 * PX_PER_HOUR,
    )
  })

  it('floors a timed card with no end to the default block', () => {
    expect(cardHeightPx(card({ startTime: '10:00' }), START, END)).toBe(PX_PER_HOUR)
  })

  it('treats an explicit auto the same as absent', () => {
    expect(cardHeightPx(card({ size: 'auto', startTime: '10:00', endTime: '11:30' }), START, END)).toBe(
      1.5 * PX_PER_HOUR,
    )
  })
})

describe('cardHeightPx — presets', () => {
  it('small is a half-hour sliver regardless of the window', () => {
    expect(cardHeightPx(card({ size: 'small' }), START, END)).toBe(0.5 * PX_PER_HOUR)
  })

  it('half is half the day window', () => {
    // 15h window → 7.5h.
    expect(cardHeightPx(card({ size: 'half' }), START, END)).toBe(7.5 * PX_PER_HOUR)
  })

  it('full is the whole day window', () => {
    expect(cardHeightPx(card({ size: 'full' }), START, END)).toBe(15 * PX_PER_HOUR)
    expect(cardHeightPx(card({ size: 'full' }), START, END)).toBe(windowHeightPx(START, END))
  })

  it('half/full track a different window', () => {
    // 08:00–16:00 → 8h window.
    expect(cardHeightPx(card({ size: 'half' }), '08:00', '16:00')).toBe(4 * PX_PER_HOUR)
    expect(cardHeightPx(card({ size: 'full' }), '08:00', '16:00')).toBe(8 * PX_PER_HOUR)
  })

  it('a preset ignores start/end times', () => {
    expect(cardHeightPx(card({ size: 'full', startTime: '10:00', endTime: '10:30' }), START, END)).toBe(
      15 * PX_PER_HOUR,
    )
  })

  it('half floors to the default block for a tiny window', () => {
    // 1h window → half would be 0.5h, floored to 1h.
    expect(cardHeightPx(card({ size: 'half' }), '06:00', '07:00')).toBe(DEFAULT_CARD_HOURS * PX_PER_HOUR)
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
