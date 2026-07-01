// Pure helpers for the desktop multi-week board affordances (§9): the right-edge
// scroll fade, the jump-to-today target, and the visible date-range stepper label.
// DOM-free so they unit-test without a browser — callers pass the three metrics an
// HTMLElement exposes ({ scrollWidth, clientWidth, scrollLeft }) via structural typing.

import { formatDay } from '../../data/dateFormat'
import type { Day } from '../../data/schema'

/** Column stride: DayColumn's `w-56` (224px) + the board row's `gap-3` (12px).
 *  Also stated in useViewport.ts (COLUMN_WIDTH_PX/COLUMN_GAP_PX) — keep in sync if
 *  the column is ever narrowed. */
export const COLUMN_STRIDE_PX = 236

export interface HScrollMetrics {
  scrollWidth: number
  clientWidth: number
  scrollLeft: number
}

/** Slack (px) so sub-pixel rounding at the right edge doesn't pin the fade on. */
const EDGE_EPSILON = 2

/** Show the right-edge fade only when the columns overflow AND we're not already
 *  scrolled to the right end. Mirrors {@link showScrollHint} for the horizontal axis. */
export function showRightFade({ scrollWidth, clientWidth, scrollLeft }: HScrollMetrics): boolean {
  const overflowing = scrollWidth > clientWidth + EDGE_EPSILON
  const atRight = scrollLeft + clientWidth >= scrollWidth - EDGE_EPSILON
  return overflowing && !atRight
}

/** Index of today's column within the trip, or -1 when today is outside the trip
 *  (so the caller hides "Jump to today"). */
export function todayIndex(days: Day[], todayKey: string): number {
  return days.findIndex((d) => d.key === todayKey)
}

/** First/last visible column indices for the current scroll offset, clamped to the
 *  trip. Null when there are no days. */
export function visibleRange(
  dayCount: number,
  { clientWidth, scrollLeft }: Pick<HScrollMetrics, 'clientWidth' | 'scrollLeft'>,
): { first: number; last: number } | null {
  if (dayCount <= 0) return null
  const clamp = (n: number) => Math.min(Math.max(n, 0), dayCount - 1)
  const first = clamp(Math.round(scrollLeft / COLUMN_STRIDE_PX))
  const perView = Math.max(1, Math.floor(clientWidth / COLUMN_STRIDE_PX))
  const last = clamp(first + perView - 1)
  return { first, last }
}

/** The stepper's European date-span label, e.g. '30.04 – 13.05' (a single day when
 *  only one column is visible). '' when there are no days. */
export function rangeLabel(
  days: Day[],
  metrics: Pick<HScrollMetrics, 'clientWidth' | 'scrollLeft'>,
): string {
  const range = visibleRange(days.length, metrics)
  if (!range) return ''
  const start = formatDay(days[range.first].key)
  return range.first === range.last ? start : `${start} – ${formatDay(days[range.last].key)}`
}
