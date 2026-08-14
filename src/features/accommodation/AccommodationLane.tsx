// The lane of accommodation bars, sitting above the day columns and aligned to
// them. It mirrors the board's column geometry with a CSS grid — one grid track
// per day, the same width and gap as the columns — so a bar placed with
// `gridColumn` stretches continuously across exactly the days its stay covers
// (the inter-column gaps fall inside a spanning grid item). Overlapping stays are
// packed onto separate grid rows by `packAccommodations`.

import { uncoveredGaps } from '../../data/cityResolution'
import type { Accommodation, City, Day } from '../../data/schema'
import { AccommodationBar } from './AccommodationBar'
import { packAccommodations } from './accommodationSpan'
import {
  COLUMN_GAP_PX,
  COLUMN_GAP_REM,
  COLUMN_WIDTH_PX,
  COLUMN_WIDTH_REM,
} from '../board/useViewport'

/**
 * Horizontal breathing room inside each lane cell. Day columns sit flush now, so
 * the space between neighbouring stays comes from here rather than a grid gap.
 */
export const LANE_CELL_INSET_PX = 3

/** Half one day track plus half its following gap, within a multi-day grid cell. */
function halfDayInset(span: number): string {
  return `calc(${(50 / span).toFixed(4)}% + ${(COLUMN_GAP_PX / (2 * span)).toFixed(4)}px)`
}

export interface AccommodationLaneProps {
  days: Day[]
  accommodations: Accommodation[]
  /** City lookup for coloring each bar. */
  cityById: Map<string, City>
  onEditAccommodation?: (accommodation: Accommodation) => void
  /**
   * Open the create editor. `startNight` seeds the first uncovered night.
   */
  onAddStay?: (startNight?: string) => void
  /**
   * Width of the board's sticky hour gutter. The lane is inset by it so its
   * tracks line up with the day columns beside it (v4 puts the stays band
   * directly above the day headers, sharing their boundaries).
   */
  gutterPx?: number
}

export function AccommodationLane({
  days,
  accommodations,
  cityById,
  onEditAccommodation,
  onAddStay,
  gutterPx = 0,
}: AccommodationLaneProps) {
  if (days.length === 0) return null
  const placed = packAccommodations(days, accommodations)
  // Each uncovered gap gets an "Add stay" button on its first day; no bar ever
  // covers a gap day, so row 1 of that column is always free.
  const dayIndex = new Map(days.map((d, i) => [d.key, i]))
  const gaps = uncoveredGaps(days, accommodations)
  const minimumLaneWidth =
    days.length * COLUMN_WIDTH_PX + Math.max(0, days.length - 1) * COLUMN_GAP_PX

  return (
    // No bottom margin: the stays band and the day-header row meet flush, with a
    // hairline under the band so it reads as its own row. Only under — the
    // toolbar already draws the rule above, and doubling them reads as one
    // 2px line.
    <div className="flex w-max min-w-full border-b border-hour-rule">
      {gutterPx > 0 && (
        <div
          aria-hidden
          style={{ width: gutterPx, flex: `0 0 ${gutterPx}px` }}
          // Sticky and opaque, so it would paint over the parent's rule and stop
          // the line dead at the hour margin; it carries its own to continue it.
          className="sticky left-0 z-30 border-b border-hour-rule bg-white"
        />
      )}
      <div
        data-testid="accommodation-lane"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${days.length}, minmax(${COLUMN_WIDTH_REM}, 1fr))`,
          minWidth: minimumLaneWidth,
          columnGap: COLUMN_GAP_REM,
          rowGap: '0.25rem',
        }}
        className="flex-1 border-x border-edge-divider py-1.5"
      >
        {placed.map((p) => {
          const bar = (
            <AccommodationBar
              accommodation={p.accommodation}
              city={p.accommodation.cityId ? cityById.get(p.accommodation.cityId) : undefined}
              clippedStart={p.clippedStart}
              clippedEnd={p.clippedEnd}
              onEdit={onEditAccommodation}
            />
          )
          return (
            <div
              key={p.accommodation.id}
              data-testid="accommodation-cell"
              data-acc={p.accommodation.id}
              data-half={p.half}
              data-start-half={p.startHalf || undefined}
              data-end-half={p.endHalf || undefined}
              style={{
                gridColumn: `${p.startIndex + 1} / span ${p.span}`,
                gridRow: p.row + 1,
              }}
              // Columns are flush now, so the breathing room between neighbouring
              // stays comes from the cell rather than a grid gap.
              className="px-[3px]"
            >
              {/* Two stays sharing a day split the row: each takes half the width, the
                earlier on the left, the later pushed right. A changeover pair instead
                insets the bar by half a day so the outgoing and incoming bars meet at
                the middle of the shared day. */}
              {p.half ? (
                <div style={{ width: '50%', marginLeft: p.half === 'right' ? 'auto' : undefined }}>
                  {bar}
                </div>
              ) : p.startHalf || p.endHalf ? (
                <div
                  style={{
                    marginLeft: p.startHalf ? halfDayInset(p.span) : undefined,
                    marginRight: p.endHalf ? halfDayInset(p.span) : undefined,
                  }}
                >
                  {bar}
                </div>
              ) : (
                bar
              )}
            </div>
          )
        })}

        {gaps.map((gap) => (
          <button
            key={`gap-${gap[0]}`}
            type="button"
            data-testid="add-stay-gap"
            data-gap-start={gap[0]}
            aria-label={`New stay starting ${gap[0]}`}
            onClick={() => onAddStay?.(gap[0])}
            style={{ gridColumn: (dayIndex.get(gap[0]) ?? 0) + 1, gridRow: 1 }}
            className="mx-[3px] flex h-[22px] items-center justify-center rounded-chip border border-dashed border-edge-300 font-sans text-[10.5px] font-semibold text-ink-500 hover:border-ink-300 hover:bg-surface-chip"
          >
            + Add stay
          </button>
        ))}
      </div>

    </div>
  )
}
