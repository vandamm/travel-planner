// The hover "＋ plan something" band that stands in for the old dashed
// empty-slot boxes (v4: "empty time is empty").
//
// Free time renders as nothing at all. Hovering a gap of 45 minutes or more
// floats a one-hour band under the cursor — the full gap when the gap is
// shorter than an hour — snapped to quarter-hours and clamped inside the gap.
// Clicking it opens the editor with that start time, running to the end of the
// gap (the next card, or the end of the day window in the last gap).
//
// Pure math, so the geometry is unit-testable and the component only has to
// wire a pointermove.

import { PX_PER_HOUR, SNAP_MINUTES, clockMinutes, clockString } from '../cards/cardHeight'

/** Gaps shorter than this get no hover affordance at all — use the header ＋. */
export const PLAN_BAND_MIN_GAP_MINUTES = 45
/** The band's nominal length; a shorter gap collapses it to the gap. */
export const PLAN_BAND_MINUTES = 60

const SNAP_PX = (SNAP_MINUTES / 60) * PX_PER_HOUR

/** Whether a free slot is long enough to offer the hover band. */
export function showsPlanBand(startTime: string, endTime: string): boolean {
  return clockMinutes(endTime) - clockMinutes(startTime) >= PLAN_BAND_MIN_GAP_MINUTES
}

/** The band's height: one hour, or the whole gap when the gap is shorter. */
export function planBandHeightPx(gapHeightPx: number): number {
  return Math.min((PLAN_BAND_MINUTES / 60) * PX_PER_HOUR, gapHeightPx)
}

/**
 * Where the band's top sits for a pointer `offsetPx` from the gap's top: centred
 * on the cursor, snapped to {@link SNAP_MINUTES}, clamped so the band never
 * escapes the gap.
 */
export function planBandTopPx(offsetPx: number, gapHeightPx: number): number {
  const height = planBandHeightPx(gapHeightPx)
  const centred = offsetPx - height / 2
  const snapped = Math.round(centred / SNAP_PX) * SNAP_PX
  return Math.max(0, Math.min(gapHeightPx - height, snapped))
}

/**
 * The start time and length a click at `topPx` inside a gap should seed: exactly
 * the band the user is looking at — an hour, or the whole gap when the gap is
 * shorter.
 *
 * The reference also says "a new card fills the gap … up to the next card", but
 * the band it draws is always one hour. Following that literally would turn one
 * click on an empty day into a 15-hour card, and would make the band a
 * misleading preview of its own result — so the band wins and the card matches
 * what was on screen.
 */
export function planBandTiming(
  startTime: string,
  endTime: string,
  topPx: number,
): { startTime: string; durationHours: number } {
  const gapStart = clockMinutes(startTime)
  const gapMinutes = clockMinutes(endTime) - gapStart
  const offsetMinutes = Math.round((topPx / PX_PER_HOUR) * 60 / SNAP_MINUTES) * SNAP_MINUTES
  const start = gapStart + offsetMinutes
  const minutes = Math.max(SNAP_MINUTES, Math.min(PLAN_BAND_MINUTES, gapMinutes))
  return { startTime: clockString(start), durationHours: minutes / 60 }
}
