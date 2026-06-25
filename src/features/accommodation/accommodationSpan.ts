// Pure geometry: map an accommodation's inclusive night span onto the board's
// day columns, and pack overlapping stays into stacked rows so their bars never
// collide.
//
// The board lays out one column per day; an accommodation bar should stretch
// continuously across exactly the columns whose nights it covers (the same
// coverage rule city resolution uses — see `cityResolution.ts`). This module is
// environment-agnostic and side-effect free so it can be unit-tested without the
// DOM, then consumed by `AccommodationLane` for layout.

import { accommodationCoversDay } from '../../data/cityResolution'
import type { Accommodation, Day } from '../../data/schema'

/** Where a stay's bar sits across the day columns. */
export interface ColumnSpan {
  /** 0-based index of the first covered day column. */
  startIndex: number
  /** Number of day columns the bar covers (always ≥ 1). */
  span: number
  /** The stay begins before the first visible day (bar is clipped at the start). */
  clippedStart: boolean
  /** The stay ends after the last visible day (bar is clipped at the end). */
  clippedEnd: boolean
}

/** A stay placed onto a specific stacking row of the lane. */
export interface PlacedAccommodation extends ColumnSpan {
  accommodation: Accommodation
  /** 0-based stacking row; overlapping stays get distinct rows. */
  row: number
}

/**
 * Compute the column span a stay occupies among the ordered `days`. Returns
 * `null` when the stay does not overlap any visible day (entirely before or
 * after the trip), so callers can skip rendering it. The span is clamped to the
 * visible range; `clippedStart`/`clippedEnd` flag overflow beyond it.
 */
export function accommodationColumnSpan(days: Day[], acc: Accommodation): ColumnSpan | null {
  if (days.length === 0) return null

  let startIndex = -1
  let endIndex = -1
  days.forEach((day, index) => {
    if (accommodationCoversDay(acc, day.key)) {
      if (startIndex === -1) startIndex = index
      endIndex = index
    }
  })
  if (startIndex === -1) return null

  return {
    startIndex,
    span: endIndex - startIndex + 1,
    clippedStart: acc.startNight < days[0].key,
    clippedEnd: acc.endNight > days[days.length - 1].key,
  }
}

/**
 * Place every visible stay onto stacking rows. Stays are ordered by their start
 * column (then by night/label for a stable layout) and greedily assigned to the
 * first row whose last-occupied column ends before this stay begins, so two
 * stays that share a column (e.g. a checkout/check-in day) land on separate rows
 * instead of overlapping. Stays outside the visible range are dropped.
 */
export function packAccommodations(
  days: Day[],
  accommodations: Accommodation[],
): PlacedAccommodation[] {
  const placed = accommodations
    .map((accommodation): PlacedAccommodation | null => {
      const span = accommodationColumnSpan(days, accommodation)
      return span ? { accommodation, row: 0, ...span } : null
    })
    .filter((p): p is PlacedAccommodation => p !== null)
    .sort(
      (a, b) =>
        a.startIndex - b.startIndex ||
        a.accommodation.startNight.localeCompare(b.accommodation.startNight) ||
        a.accommodation.label.localeCompare(b.accommodation.label),
    )

  // The last column index occupied in each row so far.
  const rowEnds: number[] = []
  for (const p of placed) {
    let row = rowEnds.findIndex((end) => end < p.startIndex)
    if (row === -1) row = rowEnds.length
    rowEnds[row] = p.startIndex + p.span - 1
    p.row = row
  }
  return placed
}
