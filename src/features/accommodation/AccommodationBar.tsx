// A single accommodation rendered as a horizontal bar. Purely presentational:
// it shows the stay's label, is colored by its resolved city (so the bar matches
// the day headers it sits above), and reports clicks to `onEdit`. Positioning
// across the day columns is the lane's job (`AccommodationLane`); this component
// just fills the slot it is given. Clipping arrows hint that the stay extends
// beyond the visible trip range.

import type { Accommodation, City } from '../../data/schema'
import { NO_CITY_COLOR } from '../cities/colors'

export interface AccommodationBarProps {
  accommodation: Accommodation
  /** Resolved city for the stay, if any (drives the bar color). */
  city?: City
  /** The stay begins before the first visible day. */
  clippedStart?: boolean
  /** The stay ends after the last visible day. */
  clippedEnd?: boolean
  /** Called with the stay when the user clicks it to edit. */
  onEdit?: (accommodation: Accommodation) => void
}

export function AccommodationBar({
  accommodation,
  city,
  clippedStart,
  clippedEnd,
  onEdit,
}: AccommodationBarProps) {
  return (
    <button
      type="button"
      data-testid="accommodation-bar"
      data-acc={accommodation.id}
      aria-label={`Edit stay ${accommodation.label}`}
      onClick={() => onEdit?.(accommodation)}
      style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
      className="flex h-7 w-full items-center gap-1 overflow-hidden rounded-md px-2 text-left text-xs font-semibold text-white shadow-sm ring-1 ring-black/10 hover:brightness-95"
    >
      {clippedStart && <span aria-hidden>‹</span>}
      <span data-testid="accommodation-label" className="truncate">
        {accommodation.label}
      </span>
      {clippedEnd && <span aria-hidden className="ml-auto">›</span>}
    </button>
  )
}
