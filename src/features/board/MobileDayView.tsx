// The mobile single-day view: one day at a time below the laptop breakpoint,
// with prev/next controls and left/right swipe to page between days. It reuses
// the exact same building blocks as the desktop board — `resolveDayCity` for the
// day's accommodation-driven city/color and `<DayColumn>` for the cards laid out
// in the viewer's time direction — so the two views never drift. Purely
// presentational: it receives the board's already-computed data as props and is
// wrapped in <BoardDnd> by <Board> so within-day reordering still works.

import { useRef, useState } from 'react'
import { resolveDayCity } from '../../data/cityResolution'
import type { Accommodation, Card, City, Day } from '../../data/schema'
import { DayColumn } from './DayColumn'
import type { TimeDirection } from './timeDirection'

/** Minimum horizontal travel (px) for a touch gesture to count as a swipe. */
const SWIPE_THRESHOLD = 40

export interface MobileDayViewProps {
  days: Day[]
  /** Cards grouped by day key. */
  cardsByDay: Map<string, Card[]>
  accommodations: Accommodation[]
  /** Per-day city overrides (day key → city id). */
  overrides: Record<string, string>
  /** City lookup for coloring the day header. */
  cityById: Map<string, City>
  direction: TimeDirection
  onAddCard?: (dayKey: string) => void
  onEditCard?: (card: Card) => void
}

/**
 * Clamp a day index to the valid range `[0, dayCount - 1]`, so paging or
 * swiping can never run off either end. Returns 0 when there are no days.
 */
export function clampDayIndex(index: number, dayCount: number): number {
  if (dayCount <= 0) return 0
  return Math.min(Math.max(index, 0), dayCount - 1)
}

export function MobileDayView({
  days,
  cardsByDay,
  accommodations,
  overrides,
  cityById,
  direction,
  onAddCard,
  onEditCard,
}: MobileDayViewProps) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  if (days.length === 0) return null

  // The trip can shrink (fewer days) under us, so clamp on every render rather
  // than trusting the stored index.
  const safeIndex = clampDayIndex(index, days.length)
  const day = days[safeIndex]
  const cityId = resolveDayCity(day.key, accommodations, overrides)
  const city = cityId ? cityById.get(cityId) : undefined

  const atFirst = safeIndex === 0
  const atLast = safeIndex === days.length - 1
  const go = (delta: number) => setIndex((i) => clampDayIndex(clampDayIndex(i, days.length) + delta, days.length))

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null) return
    const delta = (event.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(delta) < SWIPE_THRESHOLD) return
    // Swipe left (negative delta) advances; swipe right goes back.
    go(delta < 0 ? 1 : -1)
  }

  return (
    <div
      data-testid="mobile-day-view"
      className="px-4 pb-4"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous day"
          disabled={atFirst}
          onClick={() => go(-1)}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span data-testid="mobile-day-position" className="text-sm font-medium text-slate-600">
          Day {safeIndex + 1} of {days.length}
        </span>
        <button
          type="button"
          aria-label="Next day"
          disabled={atLast}
          onClick={() => go(1)}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next ›
        </button>
      </div>

      <div className="flex justify-center">
        <DayColumn
          day={day}
          city={city}
          cards={cardsByDay.get(day.key) ?? []}
          direction={direction}
          onAddCard={onAddCard}
          onEditCard={onEditCard}
        />
      </div>
    </div>
  )
}
