// The mobile single-day view: one day at a time below 640px,
// with prev/next controls and left/right swipe to page between days. It reuses
// the exact same building blocks as the desktop board — `resolveDayCity` for the
// day's accommodation-driven city/color and `<DayColumn>` for the cards laid out
// in chronological order — so the two views never drift. Purely
// presentational: it receives the board's already-computed data as props and is
// wrapped in <BoardDnd> by <Board> so within-day reordering still works.

import { format, isWeekend, parseISO } from 'date-fns'
import { useLayoutEffect, useRef, useState } from 'react'
import { resolveDayCity } from '../../data/cityResolution'
import { formatDay } from '../../data/dateFormat'
import { toDayKey } from '../../data/days'
import { NO_CITY_COLOR } from '../cities/colors'
import { HourGutter } from './HourGutter'
import { localClock, nowLine } from './nowLine'
import { MOBILE_GUTTER_PX } from './useViewport'
import type {
  Accommodation,
  Card,
  City,
  Day,
  DayCityOverride,
  DayCityOverrides,
} from '../../data/schema'
import { AccommodationLane } from '../accommodation/AccommodationLane'
import { DayColumn } from './DayColumn'
import { CityPicker } from '../cities/CityPicker'
import { clampDayIndex } from './mobileDayViewMath'
import { dayDotColor } from './pagerDot'

/** Minimum horizontal travel (px) for a touch gesture to count as a swipe. */
const SWIPE_THRESHOLD = 40

export interface MobileDayViewProps {
  days: Day[]
  /** Cards grouped by day key. */
  cardsByDay: Map<string, Card[]>
  accommodations: Accommodation[]
  /** Per-day city overrides (day key → city id). */
  overrides: DayCityOverrides
  /** City lookup for coloring the day header. */
  cityById: Map<string, City>
  /** All cities, forwarded to each day's override picker. */
  cities?: City[]
  /** Day timeline window 'HH:mm', forwarded to the day column. */
  dayStart?: string
  dayEnd?: string
  /** How many day columns to show per page (≥1); pages advance by this count. */
  columns?: number
  onAddCard?: (dayKey: string, startTime?: string, durationHours?: number) => void
  onEditCard?: (card: Card) => void
  onEditAccommodation?: (accommodation: Accommodation) => void
  onAddStay?: (startNight?: string) => void
  /** Set, explicitly clear, or return a day's city to Auto. */
  onSetCity?: (dayKey: string, cityId: DayCityOverride | undefined) => void
  onSwapDay?: (dayKey: string) => void
}

export function MobileDayView({
  days,
  cardsByDay,
  accommodations,
  overrides,
  cityById,
  cities,
  dayStart,
  dayEnd,
  columns = 1,
  onAddCard,
  onEditCard,
  onEditAccommodation,
  onAddStay,
  onSetCity,
  onSwapDay,
}: MobileDayViewProps) {
  const [index, setIndex] = useState(0)
  const [hasScrolled, setHasScrolled] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The trip can shrink (fewer days) under us, so clamp on every render rather
  // than trusting the stored index.
  const safeIndex = clampDayIndex(index, days.length)

  // Reset the scroll container to the top whenever the visible day changes
  // (prev/next, a pager dot, or a trip that shrank under us — all route through
  // `index`), so a new day opens at its header instead of inheriting the prior
  // day's offset. Runs before the hint effect so the recompute sees scrollTop 0.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [safeIndex])

  if (days.length === 0) return null

  const perPage = Math.max(1, columns)
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
  const activeDay = days[safeIndex]
  const activeCityId = resolveDayCity(activeDay.key, accommodations, overrides)
  const activeCity = activeCityId ? cityById.get(activeCityId) : undefined
  const todayKey = toDayKey(new Date())
  const now = nowLine(
    visible,
    todayKey,
    localClock(new Date()),
    dayStart ?? '06:00',
    dayEnd ?? '21:00',
  )

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
      className="flex h-full min-h-0 flex-col px-4"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Stays first — the stay chip sits directly under the app header, above
          the date/city block, the same order as the desktop board. */}
      <AccommodationLane
        days={visible}
        accommodations={accommodations}
        cityById={cityById}
        onEditAccommodation={onEditAccommodation}
        onAddStay={onAddStay}
      />

      <div className="flex items-center justify-between pt-2">
        <span
          data-testid="mobile-day-label"
          className={`font-sans text-[9px] font-extrabold uppercase tracking-[0.18em] ${isWeekend(parseISO(activeDay.key)) ? 'text-city-vermilion' : 'text-ink-400'}`}
        >
          {format(parseISO(activeDay.key), 'EEE').toUpperCase()} · {formatDay(activeDay.key)}
        </span>
        <span className="flex items-center gap-[9px]">
          {onSwapDay && (
            <button
              type="button"
              aria-label="Swap day"
              title="Swap day"
              onClick={() => onSwapDay(activeDay.key)}
              className="font-sans text-[11px] leading-none text-ink-200 hover:text-ink-600"
            >
              <span aria-hidden>⇄</span>
            </button>
          )}
          {onAddCard && (
            <button
              type="button"
              aria-label="Add activity to this day"
              title="Add activity to this day"
              onClick={() => onAddCard(activeDay.key)}
              className="font-sans text-[17px] font-semibold leading-none text-ink-200 transition-[color,transform] duration-150 ease-out hover:scale-[1.15] hover:text-city-vermilion"
            >
              <span aria-hidden>+</span>
            </button>
          )}
        </span>
      </div>

      <div data-testid="mobile-city-row" className="flex items-center gap-1.5">
        <span className="truncate font-serif text-[18px] font-bold text-ink">
          {activeCity?.name ?? 'No city'}
        </span>
        {(cities?.length ?? 0) > 0 && (
          <CityPicker
            label="Choose city"
            value={overrides[activeDay.key]}
            resolvedCityId={activeCity?.id}
            cities={cities ?? []}
            includeNoCity
            bareEdit
            onChange={(id) => onSetCity?.(activeDay.key, id)}
          />
        )}
      </div>
      <div
        data-testid="mobile-city-band"
        style={{ backgroundColor: activeCity?.color ?? NO_CITY_COLOR }}
        className="mb-3 mt-2 h-1 w-full rounded-[2px]"
      />

      <div
        className="min-h-0 flex-1 overflow-y-auto pb-4 pt-1.5"
        ref={scrollRef}
        data-testid="mobile-day-scroll"
        data-scrolled={hasScrolled ? '' : undefined}
        onScroll={(event) => setHasScrolled(event.currentTarget.scrollTop > 4)}
      >
        <div className="flex">
          {/* The hour rail stays on the screen-left, shared by the visible days. */}
          <HourGutter
            dayStart={dayStart ?? '06:00'}
            dayEnd={dayEnd ?? '21:00'}
            widthPx={MOBILE_GUTTER_PX}
            nowOffsetPx={now?.offsetPx}
            nowClock={now?.clock}
            compact
          />
          {visible.map((day, index) => {
            const cityId = resolveDayCity(day.key, accommodations, overrides)
            return (
              <DayColumn
                key={day.key}
                day={day}
                city={cityId ? cityById.get(cityId) : undefined}
                cards={cardsByDay.get(day.key) ?? []}
                dayStart={dayStart}
                dayEnd={dayEnd}
                cities={cities}
                overrideCityId={overrides[day.key]}
                onSetCity={onSetCity}
                onSwapDay={onSwapDay}
                onAddCard={onAddCard}
                onEditCard={onEditCard}
                showHeader={false}
                fluid
                nowOffsetPx={now?.offsetPx}
                isToday={day.key === todayKey}
                firstColumn={index === 0}
              />
            )
          })}
        </div>
      </div>

      {/* Day switcher lives at the base of the screen, not the top. */}
      <div
        data-testid="mobile-day-footer"
        className="-mx-4 mt-auto border-t border-ink-frame bg-surface-raised px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous day"
            disabled={atFirst}
            onClick={() => go(-1)}
            className="rounded-card border border-edge-350 bg-white px-[11px] py-1.5 font-sans text-[11px] font-semibold text-ink-600 disabled:cursor-not-allowed disabled:text-ink-200"
          >
            ‹ Prev
          </button>
          <span
            data-testid="mobile-day-position"
            className="font-sans text-[11.5px] font-semibold text-ink-600"
          >
            {firstPos === lastPos ? `Day ${firstPos}` : `Days ${firstPos}–${lastPos}`} of{' '}
            {days.length}
          </span>
          <button
            type="button"
            aria-label="Next day"
            disabled={atLast}
            onClick={() => go(1)}
            className="rounded-card border border-edge-350 bg-white px-[11px] py-1.5 font-sans text-[11px] font-semibold text-ink-600 disabled:cursor-not-allowed disabled:text-ink-200"
          >
            Next ›
          </button>
        </div>
        <div
          data-testid="mobile-day-dots"
          // flex-wrap so a long trip's dots wrap to more rows instead of
          // overflowing the phone width horizontally.
          className="flex flex-wrap items-center justify-center gap-1.5 px-1.5 pb-0.5 pt-2"
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
                className={`h-[7px] w-[7px] rounded-full transition-colors ${isActive ? '' : 'bg-edge-250'}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
