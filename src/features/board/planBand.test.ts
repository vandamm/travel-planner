import { describe, expect, it } from 'vitest'
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
    expect(planBandHeightPx(600)).toBe(60)
    expect(planBandHeightPx(60)).toBe(60)
    expect(planBandHeightPx(45)).toBe(45)
  })
})

describe('planBandTopPx', () => {
  it('centres the band on the pointer, snapped to quarter-hours', () => {
    // 200 - 30 = 170 → snapped to the nearest 15px step.
    expect(planBandTopPx(200, 600)).toBe(165)
    // 97 - 30 = 67 → nearest step is 60, not 75.
    expect(planBandTopPx(97, 600)).toBe(60)
  })

  it('clamps the band inside the gap at both ends', () => {
    expect(planBandTopPx(0, 600)).toBe(0)
    expect(planBandTopPx(-50, 600)).toBe(0)
    expect(planBandTopPx(600, 600)).toBe(540)
    expect(planBandTopPx(9999, 600)).toBe(540)
    // A gap shorter than the band has nowhere to move.
    expect(planBandTopPx(20, 45)).toBe(0)
  })
})

describe('planBandTiming', () => {
  it('seeds exactly the band the user saw — one hour, wherever it sits', () => {
    expect(planBandTiming('09:00', '19:00', 0)).toEqual({ startTime: '09:00', durationHours: 1 })
    expect(planBandTiming('09:00', '19:00', 165)).toEqual({
      startTime: '11:45',
      durationHours: 1,
    })
  })

  it('shrinks to the gap when the gap is under an hour', () => {
    expect(planBandTiming('09:00', '09:45', 0)).toEqual({ startTime: '09:00', durationHours: 0.75 })
  })
})
