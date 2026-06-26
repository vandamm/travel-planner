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
  /**
   * When exactly two stays overlap, they share one row split left/right
   * (earlier = `'left'`, later = `'right'`) instead of stacking. Undefined for a
   * lone stay or a group of 3+ overlaps (which fall back to row stacking).
   */
  half?: 'left' | 'right'
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
 * Place every visible stay onto rows of the lane. Stays are ordered by start
 * column (then night/label for a stable layout), then grouped into clusters of
 * column-overlapping stays. Within a cluster:
 *
 * - a lone stay sits on row 0;
 * - exactly two stays covering the *same* columns share row 0, split left/right
 *   (earlier = `'left'`, later = `'right'`) — issue 7's "two stays on one day"
 *   case. The halves only line up on the shared day when the spans are identical;
 *   a partial overlap stacks instead (each bar then sits correctly on its own
 *   columns);
 * - three or more fall back to greedy row stacking so their bars never collide.
 *
 * Clusters never overlap each other in columns, so each starts its rows at 0.
 * Stays outside the visible range are dropped.
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

  const placeCluster = (cluster: PlacedAccommodation[]) => {
    // Two stays covering the exact same columns split that one row left/right.
    // (Partial overlaps fall through to stacking: half-width bars aligned to
    // each stay's own span wouldn't meet on the day they actually share.)
    if (
      cluster.length === 2 &&
      cluster[0].startIndex === cluster[1].startIndex &&
      cluster[0].span === cluster[1].span
    ) {
      cluster[0].row = 0
      cluster[0].half = 'left'
      cluster[1].row = 0
      cluster[1].half = 'right'
      return
    }
    // Lone stay, partial overlap, or 3+ overlaps: greedily stack onto the first free row.
    const rowEnds: number[] = []
    for (const p of cluster) {
      let row = rowEnds.findIndex((end) => end < p.startIndex)
      if (row === -1) row = rowEnds.length
      rowEnds[row] = p.startIndex + p.span - 1
      p.row = row
    }
  }

  // Walk the sorted stays, merging each into the current cluster while it starts
  // at or before the cluster's running end column (inclusive ranges → overlap).
  let cluster: PlacedAccommodation[] = []
  let clusterEnd = -1
  for (const p of placed) {
    if (cluster.length > 0 && p.startIndex > clusterEnd) {
      placeCluster(cluster)
      cluster = []
      clusterEnd = -1
    }
    cluster.push(p)
    clusterEnd = Math.max(clusterEnd, p.startIndex + p.span - 1)
  }
  if (cluster.length > 0) placeCluster(cluster)

  return placed
}
