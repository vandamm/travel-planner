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
import { COLUMN_GAP_REM, COLUMN_WIDTH_REM } from '../board/useViewport'

/** Half a column (incl. its gap) — a changeover bar starts/ends at the day's middle. */
const HALF_DAY_INSET = `calc((${COLUMN_WIDTH_REM} + ${COLUMN_GAP_REM}) / 2)`

export interface AccommodationLaneProps {
  days: Day[]
  accommodations: Accommodation[]
  /** City lookup for coloring each bar. */
  cityById: Map<string, City>
  onEditAccommodation?: (accommodation: Accommodation) => void
  /**
   * Open the create editor. `startNight` seeds the first night — the per-gap
   * buttons pass their gap's first day; the right-end button passes nothing.
   */
  onAddStay?: (startNight?: string) => void
}

export function AccommodationLane({
  days,
  accommodations,
  cityById,
  onEditAccommodation,
  onAddStay,
}: AccommodationLaneProps) {
  if (days.length === 0) return null
  const placed = packAccommodations(days, accommodations)
  // Each uncovered gap gets an "Add stay" button on its first day; no bar ever
  // covers a gap day, so row 1 of that column is always free.
  const dayIndex = new Map(days.map((d, i) => [d.key, i]))
  const gaps = uncoveredGaps(days, accommodations)

  return (
    <div className="mb-2 flex flex-col items-start gap-3 md:flex-row">
      <div
        data-testid="accommodation-lane"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${days.length}, ${COLUMN_WIDTH_REM})`,
          columnGap: COLUMN_GAP_REM,
          rowGap: '0.25rem',
        }}
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
                    marginLeft: p.startHalf ? HALF_DAY_INSET : undefined,
                    marginRight: p.endHalf ? HALF_DAY_INSET : undefined,
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
            className="flex h-7 w-full items-center justify-center rounded-md border border-dashed border-edge-300 text-xs font-medium text-ink-500 hover:border-ink-300 hover:bg-surface-chip"
          >
            + Add stay
          </button>
        ))}
      </div>

      <button
        type="button"
        data-testid="add-stay"
        aria-label="Add stay"
        onClick={() => onAddStay?.()}
        className="shrink-0 rounded border border-edge-300 bg-white px-3 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip"
      >
        + Add stay
      </button>
    </div>
  )
}
