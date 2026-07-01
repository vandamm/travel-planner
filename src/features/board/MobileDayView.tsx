// The mobile single-day view: one day at a time below the laptop breakpoint,
// with prev/next controls and left/right swipe to page between days. It reuses
// the exact same building blocks as the desktop board — `resolveDayCity` for the
// day's accommodation-driven city/color and `<DayColumn>` for the cards laid out
// in the viewer's time direction — so the two views never drift. Purely
// presentational: it receives the board's already-computed data as props and is
// wrapped in <BoardDnd> by <Board> so within-day reordering still works.

import { useLayoutEffect, useRef, useState } from 'react'
import { resolveDayCity } from '../../data/cityResolution'
import type { Accommodation, Card, City, Day } from '../../data/schema'
import { DayColumn } from './DayColumn'
import { dayDotColor } from './pagerDot'
import { showScrollHint } from './scrollHint'
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
  /** All cities, forwarded to each day's override picker. */
  cities?: City[]
  direction: TimeDirection
  /** Day timeline window 'HH:mm', forwarded to the day column. */
  dayStart?: string
  dayEnd?: string
  /** How many day columns to show per page (≥1); pages advance by this count. */
  columns?: number
  onAddCard?: (dayKey: string) => void
  onEditCard?: (card: Card) => void
  /** Set or clear a day's manual city override (`null` = Auto). */
  onSetCity?: (dayKey: string, cityId: string | null) => void
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
  cities,
  direction,
  dayStart,
  dayEnd,
  columns = 1,
  onAddCard,
  onEditCard,
  onSetCity,
}: MobileDayViewProps) {
  const [index, setIndex] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  // A full day timeline (06:00–21:00 ≈ 660px) is taller than a phone, so the day
  // column(s) live in a bounded scroll container; a fade + hint appear only while
  // there is more below. Hint visibility is derived by the pure `showScrollHint`.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(false)

  // Recompute the hint when the visible content or the viewport changes (paging,
  // card edits, the dvh-based cap on rotate/resize). `scrollRef.current` exposes
  // the three metrics `showScrollHint` needs.
  useLayoutEffect(() => {
    const update = () => {
      if (scrollRef.current) setShowHint(showScrollHint(scrollRef.current))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [index, columns, days, cardsByDay, dayStart, dayEnd, direction])

  if (days.length === 0) return null

  const perPage = Math.max(1, columns)
  // The trip can shrink (fewer days) under us, so clamp on every render rather
  // than trusting the stored index.
  const safeIndex = clampDayIndex(index, days.length)
  const visible = days.slice(safeIndex, safeIndex + perPage)
  const firstPos = safeIndex + 1
  const lastPos = safeIndex + visible.length

  const atFirst = safeIndex === 0
  // The window already reaches the last day — nowhere further to page.
  const atLast = safeIndex + perPage >= days.length
  // Page by a whole window so days never repeat between pages.
  const go = (delta: number) =>
    setIndex((i) => clampDayIndex(clampDayIndex(i, days.length) + delta * perPage, days.length))

  // One dot per page (a page = `perPage` days); active dot carries the day's city
  // colour, the rest are muted. `floor(safeIndex / perPage)` == `ceil(n/p) - 1`
  // even on the clamped trailing page, so it never exceeds the last dot.
  const pageCount = Math.ceil(days.length / perPage)
  const activePage = Math.floor(safeIndex / perPage)
  const activeColor = dayDotColor(days[safeIndex].key, accommodations, overrides, cityById)

  function onTouchStart(event: React.TouchEvent) {
    const t = event.touches[0]
    touchStart.current = t ? { x: t.clientX, y: t.clientY ?? 0 } : null
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const end = event.changedTouches[0]
    const dx = (end?.clientX ?? start.x) - start.x
    const dy = (end?.clientY ?? start.y) - start.y
    // Require a clear horizontal swipe: past the threshold AND more horizontal
    // than vertical, so a vertical scroll that drifts sideways doesn't page.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return
    // Swipe left (negative delta) advances; swipe right goes back.
    go(dx < 0 ? 1 : -1)
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
          className="rounded border border-edge-300 bg-white px-3 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span data-testid="mobile-day-position" className="text-sm font-medium text-ink-600">
          {firstPos === lastPos ? `Day ${firstPos}` : `Days ${firstPos}–${lastPos}`} of {days.length}
        </span>
        <button
          type="button"
          aria-label="Next day"
          disabled={atLast}
          onClick={() => go(1)}
          className="rounded border border-edge-300 bg-white px-3 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next ›
        </button>
      </div>

      <div
        data-testid="mobile-day-dots"
        className="mb-2 flex items-center justify-center gap-2"
      >
        {Array.from({ length: pageCount }, (_, page) => {
          const isActive = page === activePage
          const dayNo = page * perPage + 1
          return (
            <button
              key={page}
              type="button"
              aria-label={`Go to day ${dayNo}`}
              aria-current={isActive ? 'true' : undefined}
              data-testid="mobile-day-dot"
              onClick={() => setIndex(clampDayIndex(page * perPage, days.length))}
              // Inline colour only for the active dot — the sanctioned exception
              // for a city's own hue (matches DayColumn's band).
              style={isActive ? { backgroundColor: activeColor } : undefined}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${isActive ? '' : 'bg-edge-300'}`}
            />
          )
        })}
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          data-testid="mobile-day-scroll"
          onScroll={(e) => setShowHint(showScrollHint(e.currentTarget))}
          className="flex max-h-[calc(100dvh-12rem)] justify-center gap-3 overflow-y-auto"
        >
          {visible.map((day) => {
            const cityId = resolveDayCity(day.key, accommodations, overrides)
            return (
              <DayColumn
                key={day.key}
                day={day}
                city={cityId ? cityById.get(cityId) : undefined}
                cards={cardsByDay.get(day.key) ?? []}
                direction={direction}
                dayStart={dayStart}
                dayEnd={dayEnd}
                cities={cities}
                overrideCityId={overrides[day.key]}
                onSetCity={onSetCity}
                onAddCard={onAddCard}
                onEditCard={onEditCard}
              />
            )
          })}
        </div>
        {showHint && (
          <>
            <div
              aria-hidden
              data-testid="scroll-fade"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent"
            />
            <span
              data-testid="scroll-hint"
              className="pointer-events-none absolute inset-x-0 bottom-1 text-center font-sans text-xs font-medium text-ink-400"
            >
              scroll for more ↓
            </span>
          </>
        )}
      </div>
    </div>
  )
}
