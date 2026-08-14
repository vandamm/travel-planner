// The now-line and the "TODAY" pill: both derived from comparing the client's
// current date/time against the trip's days and the day window.
//
// Pure, so the board only has to render what this returns — and so the "today
// is off-screen" and "now is outside the window" cases are unit-testable without
// mocking a clock.

import { MIN_PX_PER_HOUR, clockMinutes } from '../cards/cardHeight'
import type { Day } from '../../data/schema'

/** 'HH:mm' for a Date, in the viewer's local time (the trip models no timezone). */
export function localClock(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Vertical offset (px) of the current time on the day window's scale, or `null`
 * when now falls outside the window — the line is drawn only while it would land
 * on the grid.
 */
export function nowOffsetPx(
  clock: string,
  dayStart: string,
  dayEnd: string,
  pxPerHour: number = MIN_PX_PER_HOUR,
): number | null {
  const minutes = clockMinutes(clock)
  const start = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  if (minutes < start || minutes > end) return null
  return ((minutes - start) / 60) * pxPerHour
}

/**
 * The now-line to draw for a board showing `days`, or `null` when today is not
 * one of them or now is outside the window.
 */
export function nowLine(
  days: Day[],
  todayKey: string,
  clock: string,
  dayStart: string,
  dayEnd: string,
  pxPerHour: number = MIN_PX_PER_HOUR,
): { offsetPx: number; clock: string } | null {
  if (!days.some((day) => day.key === todayKey)) return null
  const offsetPx = nowOffsetPx(clock, dayStart, dayEnd, pxPerHour)
  return offsetPx === null ? null : { offsetPx, clock }
}
