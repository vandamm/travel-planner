// The lane of accommodation bars, sitting above the day columns and aligned to
// them. It mirrors the board's column geometry with a CSS grid — one grid track
// per day, the same width and gap as the columns — so a bar placed with
// `gridColumn` stretches continuously across exactly the days its stay covers
// (the inter-column gaps fall inside a spanning grid item). Overlapping stays are
// packed onto separate grid rows by `packAccommodations`.

import type { Accommodation, City, Day } from '../../data/schema'
import { AccommodationBar } from './AccommodationBar'
import { packAccommodations } from './accommodationSpan'

/** Must match the day columns: `w-56` (14rem) tracks, `gap-3` (0.75rem) gaps. */
const COLUMN_WIDTH = '14rem'
const COLUMN_GAP = '0.75rem'

export interface AccommodationLaneProps {
  days: Day[]
  accommodations: Accommodation[]
  /** City lookup for coloring each bar. */
  cityById: Map<string, City>
  onEditAccommodation?: (accommodation: Accommodation) => void
}

export function AccommodationLane({
  days,
  accommodations,
  cityById,
  onEditAccommodation,
}: AccommodationLaneProps) {
  if (days.length === 0) return null
  const placed = packAccommodations(days, accommodations)

  return (
    <div
      data-testid="accommodation-lane"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${days.length}, ${COLUMN_WIDTH})`,
        columnGap: COLUMN_GAP,
        rowGap: '0.25rem',
      }}
      className="mb-2"
    >
      {placed.map((p) => (
        <div
          key={p.accommodation.id}
          data-testid="accommodation-cell"
          data-acc={p.accommodation.id}
          style={{
            gridColumn: `${p.startIndex + 1} / span ${p.span}`,
            gridRow: p.row + 1,
          }}
        >
          <AccommodationBar
            accommodation={p.accommodation}
            city={p.accommodation.cityId ? cityById.get(p.accommodation.cityId) : undefined}
            clippedStart={p.clippedStart}
            clippedEnd={p.clippedEnd}
            onEdit={onEditAccommodation}
          />
        </div>
      ))}
    </div>
  )
}
