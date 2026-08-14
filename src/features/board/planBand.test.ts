import { describe, expect, it } from 'vitest'
import { MIN_PX_PER_HOUR } from '../cards/cardHeight'
import {
  PLAN_BAND_MIN_GAP_MINUTES,
  planBandHeightPx,
  planBandTiming,
  planBandTopPx,
  showsPlanBand,
} from './planBand'

describe('showsPlanBand', () => {
  it('offers the band only from 45 minutes of free time', () => {
    expect(PLAN_BAND_MIN_GAP_MINUTES).toBe(45)
    expect(showsPlanBand('09:00', '09:44')).toBe(false)
    expect(showsPlanBand('09:00', '09:45')).toBe(true)
    expect(showsPlanBand('09:00', '13:00')).toBe(true)
  })
})

describe('planBandHeightPx', () => {
  it('is one hour, or the whole gap when the gap is shorter', () => {
    expect(planBandHeightPx(10 * MIN_PX_PER_HOUR)).toBe(MIN_PX_PER_HOUR)
    expect(planBandHeightPx(MIN_PX_PER_HOUR)).toBe(MIN_PX_PER_HOUR)
    // A gap shorter than an hour collapses the band to the gap.
    expect(planBandHeightPx(MIN_PX_PER_HOUR * 0.75)).toBe(MIN_PX_PER_HOUR * 0.75)
  })
})

describe('planBandTopPx', () => {
  it('centres the band on the pointer, snapped to quarter-hours', () => {
    const quarter = MIN_PX_PER_HOUR / 4
    const gap = 10 * MIN_PX_PER_HOUR
    // Pointer five hours down: the band centres on it, then snaps to a quarter.
    expect(planBandTopPx(5 * MIN_PX_PER_HOUR, gap)).toBe(4.5 * MIN_PX_PER_HOUR)
    // Half a quarter past a step rounds up to the next one.
    expect(planBandTopPx(MIN_PX_PER_HOUR + MIN_PX_PER_HOUR / 2 + quarter * 0.6, gap)).toBe(
      MIN_PX_PER_HOUR + quarter,
    )
  })

  it('clamps the band inside the gap at both ends', () => {
    const gap = 10 * MIN_PX_PER_HOUR
    const lastTop = gap - MIN_PX_PER_HOUR
    expect(planBandTopPx(0, gap)).toBe(0)
    expect(planBandTopPx(-gap, gap)).toBe(0)
    expect(planBandTopPx(gap, gap)).toBe(lastTop)
    expect(planBandTopPx(gap * 10, gap)).toBe(lastTop)
    // A gap shorter than the band has nowhere to move.
    expect(planBandTopPx(MIN_PX_PER_HOUR / 3, MIN_PX_PER_HOUR * 0.75)).toBe(0)
  })
})

describe('planBandTiming', () => {
  it('seeds exactly the band the user saw — one hour, wherever it sits', () => {
    expect(planBandTiming('09:00', '19:00', 0)).toEqual({ startTime: '09:00', durationHours: 1 })
    expect(planBandTiming('09:00', '19:00', 2.75 * MIN_PX_PER_HOUR)).toEqual({
      startTime: '11:45',
      durationHours: 1,
    })
  })

  it('shrinks to the gap when the gap is under an hour', () => {
    expect(planBandTiming('09:00', '09:45', 0)).toEqual({ startTime: '09:00', durationHours: 0.75 })
  })
})
