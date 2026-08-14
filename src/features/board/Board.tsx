// The board: a horizontally scrolling row of day columns. It owns all the doc
// reads for the board view (trip → days, accommodations + overrides → each day's
// resolved city, cities → colors, cards grouped by day) and renders a
// presentational <DayColumn> per day.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  getTrip,
  listAccommodations,
  listCards,
  listCities,
  listDayOverrides,
  setDayCityOverride,
  swapActivityDays,
} from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import { useDocVersion } from '../../data/useDoc'
import { firstUncoveredDay, resolveDayCity } from '../../data/cityResolution'
import { generateDays, toDayKey } from '../../data/days'
import { COLUMN_STRIDE_PX, rangeSummary, showRightFade, todayIndex } from './multiWeekNav'
import type { Accommodation, Card, City } from '../../data/schema'
import { AccommodationEditor } from '../accommodation/AccommodationEditor'
import { AccommodationLane } from '../accommodation/AccommodationLane'
import { CardEditor } from '../cards/CardEditor'
import { cardCategory } from '../cards/cardCategory'
import { BoardDnd } from './dndContext'
import { DayColumn } from './DayColumn'
import { HourGutter } from './HourGutter'
import { localClock, nowLine } from './nowLine'
import { DaySwapModal } from './DaySwapModal'
import { MobileDayView } from './MobileDayView'
import { BoardToolbar } from './BoardToolbar'
import { BoardEmptyState } from './BoardEmptyState'
import { useUndoManager } from './undoManager'
import { COLUMN_GAP_REM, HOUR_GUTTER_PX, useColumnsThatFit, useViewport } from './useViewport'

/** Which card the editor is open on: a new card on a day, or an existing card. */
type EditorState =
  | { mode: 'create'; dayKey: string; startTime?: string; durationHours?: number }
  | { mode: 'edit'; card: Card }

/** Which stay the accommodation editor is open on: a new one (optionally seeded
 * with a first night), or an existing one. */
type AccEditorState =
  | { mode: 'create'; startNight?: string }
  | { mode: 'edit'; accommodation: Accommodation }

export interface BoardProps {
  /** Bumped by the mobile ≡ menu's "Add stay"; each change opens the create
   *  editor (a nonce, not a boolean, so repeated taps re-open it). */
  addStayNonce?: number
  onOpenTrip?: () => void
  onOpenCities?: () => void
  onOpenShare?: () => void
  onOpenMenu?: () => void
}

export function Board({
  addStayNonce = 0,
  onOpenTrip = () => {},
  onOpenCities = () => {},
  onOpenShare = () => {},
  onOpenMenu = () => {},
}: BoardProps) {
  const { doc, status, presences } = useRoom()
  useDocVersion(doc)
  const { undo, redo, canUndo, canRedo } = useUndoManager(doc)
  const viewport = useViewport()
  const columns = useColumnsThatFit()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [accEditor, setAccEditor] = useState<AccEditorState | null>(null)
  const [swapSourceDayKey, setSwapSourceDayKey] = useState<string | null>(null)
  // Render the completed atomic drag transaction immediately; the normal doc
  // subscription still handles edits made through every other path.
  const [, rerenderAfterTimelineChange] = useState(0)
  // Desktop multi-week affordances (§9): a right-edge fade + a visible date-range
  // label, both derived from the scroll container's metrics by the pure helpers.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showFade, setShowFade] = useState(false)
  const [rangeText, setRangeText] = useState('')

  // The header's ≡ menu lives above Board but the AccommodationEditor (and its
  // board-derived night defaults) stay here, so the menu drives it via the nonce.
  useEffect(() => {
    if (addStayNonce > 0) setAccEditor({ mode: 'create' })
  }, [addStayNonce])

  const trip = getTrip(doc)
  const days = generateDays(trip.startDate, trip.endDate)
  const accommodations = listAccommodations(doc)
  const overrides = listDayOverrides(doc)
  const cities = listCities(doc)
  const cityById = new Map(cities.map((c) => [c.id, c]))
  const wordmark = trip.title.trim() || 'Travel Planner'
  const meta = `${days.length} ${days.length === 1 ? 'day' : 'days'} · ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}`
  const cityByDay = new Map<string, City | undefined>(
    days.map((day) => {
      const cityId = resolveDayCity(day.key, accommodations, overrides)
      return [day.key, cityId ? cityById.get(cityId) : undefined]
    }),
  )
  const swapSourceDay = days.find((day) => day.key === swapSourceDayKey)

  const cardsByDay = new Map<string, Card[]>()
  // Transport cards carry no ticket marker, so they never count toward the
  // toolbar's "N tickets to buy" chip either.
  let ticketsToBuy = 0
  for (const card of listCards(doc)) {
    if (card.ticketState === 'required' && cardCategory(card) !== 'transit') ticketsToBuy += 1
    const list = cardsByDay.get(card.dayKey)
    if (list) list.push(card)
    else cardsByDay.set(card.dayKey, [card])
  }

  // Recompute the fade + range label whenever the board's content or the viewport
  // changes. Runs only when the desktop scroll container is mounted (mobile leaves
  // scrollRef null).
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setShowFade(showRightFade(el))
      setRangeText(rangeSummary(days, el))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
    // Horizontal geometry + the label depend on the days, not per-card content.
  }, [viewport, days])

  // The now-line and the "TODAY" pill are both derived from the client's clock
  // against the visible days; both vanish when today is outside the trip or the
  // current time falls outside the day window.
  const todayKey = toDayKey(new Date())
  const now = nowLine(days, todayKey, localClock(new Date()), trip.dayStart, trip.dayEnd)
  const todayIdx = todayIndex(days, todayKey)
  const jumpToToday = () =>
    scrollRef.current?.scrollTo({ left: todayIdx * COLUMN_STRIDE_PX, behavior: 'smooth' })
  const pageBy = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' })
  }

  // New stay defaults to the gap button's day, else the first uncovered night,
  // else the trip start. End mirrors start (one night) — the editor's range
  // calendar extends it from there.
  const createStartNight =
    accEditor?.mode === 'create'
      ? (accEditor.startNight ??
        firstUncoveredDay(days, accommodations) ??
        trip.startDate ??
        days[0]?.key)
      : undefined

  return (
    <section
      data-testid="board-frame"
      aria-label="Board"
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
    >
      <BoardToolbar
        title={wordmark}
        meta={meta}
        status={status}
        presences={presences}
        ticketsToBuy={ticketsToBuy}
        onOpenTrip={onOpenTrip}
        onOpenCities={onOpenCities}
        onOpenShare={onOpenShare}
        onOpenMenu={onOpenMenu}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      {days.length === 0 ? (
        <BoardEmptyState onOpenTrip={onOpenTrip} />
      ) : viewport === 'mobile' ? (
        // Below 640px: one day at a time, paged by swipe or the
        // prev/next controls. Same cards/accommodation logic as desktop.
        <div className="min-h-0 flex-1">
          <BoardDnd
            doc={doc}
            dayStart={trip.dayStart}
            dayEnd={trip.dayEnd}
            onTimelineChange={() => rerenderAfterTimelineChange((version) => version + 1)}
          >
            <MobileDayView
              days={days}
              cardsByDay={cardsByDay}
              accommodations={accommodations}
              overrides={overrides}
              cityById={cityById}
              cities={cities}
              dayStart={trip.dayStart}
              dayEnd={trip.dayEnd}
              columns={columns}
              onAddCard={(dayKey, startTime, durationHours) =>
                setEditor({ mode: 'create', dayKey, startTime, durationHours })
              }
              onEditCard={(card) => setEditor({ mode: 'edit', card })}
              onSetCity={(dayKey, cityId) => setDayCityOverride(doc, dayKey, cityId)}
              onSwapDay={days.length > 1 ? setSwapSourceDayKey : undefined}
              onEditAccommodation={(accommodation) => setAccEditor({ mode: 'edit', accommodation })}
              onAddStay={(startNight) => setAccEditor({ mode: 'create', startNight })}
            />
          </BoardDnd>
        </div>
      ) : (
        // The grid scrolls in both axes so the day-range footer below it stays
        // reachable on a viewport shorter than the 06:00–21:00 window.
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            data-testid="board-scroll"
            onScroll={(e) => {
              setShowFade(showRightFade(e.currentTarget))
              setRangeText(rangeSummary(days, e.currentTarget))
            }}
            className="h-full overflow-auto"
          >
            {/* Stays lane, then the columns row — the two bands sit flush, with
                the lane inset past the sticky hour gutter so it lines up with
                the day columns and shares their boundary hairlines. */}
            <AccommodationLane
              days={days}
              accommodations={accommodations}
              cityById={cityById}
              gutterPx={HOUR_GUTTER_PX}
              onEditAccommodation={(accommodation) => setAccEditor({ mode: 'edit', accommodation })}
              onAddStay={(startNight) => setAccEditor({ mode: 'create', startNight })}
            />
            <BoardDnd
              doc={doc}
              dayStart={trip.dayStart}
              dayEnd={trip.dayEnd}
              onTimelineChange={() => rerenderAfterTimelineChange((version) => version + 1)}
            >
              {/* Not stretched to fill the scroller: HourGutter aligns its
                  labels by sitting at the bottom of a column that is exactly
                  header + body tall, so growing the columns would slide every
                  hour label off its rail. */}
              <div data-testid="board" className="flex min-w-full" style={{ gap: COLUMN_GAP_REM }}>
                <HourGutter
                  dayStart={trip.dayStart}
                  dayEnd={trip.dayEnd}
                  widthPx={HOUR_GUTTER_PX}
                  nowOffsetPx={now?.offsetPx}
                  nowClock={now?.clock}
                />
                {days.map((day, index) => {
                  const cityId = resolveDayCity(day.key, accommodations, overrides)
                  return (
                    <DayColumn
                      key={day.key}
                      day={day}
                      city={cityId ? cityById.get(cityId) : undefined}
                      cards={cardsByDay.get(day.key) ?? []}
                      dayStart={trip.dayStart}
                      dayEnd={trip.dayEnd}
                      cities={cities}
                      overrideCityId={overrides[day.key]}
                      onSetCity={(dayKey, cityId) => setDayCityOverride(doc, dayKey, cityId)}
                      onSwapDay={days.length > 1 ? setSwapSourceDayKey : undefined}
                      onAddCard={(dayKey, startTime, durationHours) =>
                        setEditor({ mode: 'create', dayKey, startTime, durationHours })
                      }
                      onEditCard={(card) => setEditor({ mode: 'edit', card })}
                      nowOffsetPx={now?.offsetPx}
                      isToday={day.key === todayKey}
                      firstColumn={index === 0}
                      // The month rides the first column and each month change,
                      // so the date reads in full without repeating it 21 times.
                      showMonth={index === 0 || day.key.endsWith('-01')}
                    />
                  )
                })}
              </div>
            </BoardDnd>
          </div>
          {/* Right-edge fade: a decorative hint that more columns lie off-screen,
              shown only while not scrolled fully right (mirrors the mobile fade). */}
          {showFade && (
            <div
              aria-hidden
              data-testid="board-fade"
              className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent"
            />
          )}
        </div>
      )}

      {/* Day-range nav sits *under* the grid, flush against the last hour rail. */}
      {viewport === 'desktop' && days.length > 0 && (
        <div
          data-testid="board-footer"
          className="flex items-center gap-3 border-t border-hour-rule px-3 py-2.5"
        >
          <div data-testid="range-stepper" className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous days"
              title="Earlier days"
              onClick={() => pageBy(-1)}
              className="h-7 w-[30px] rounded-card border border-edge-350 text-[15px] text-ink-600"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next days"
              title="Later days"
              onClick={() => pageBy(1)}
              className="h-7 w-[30px] rounded-card border border-edge-350 text-[15px] text-ink-600"
            >
              ›
            </button>
          </div>
          <span
            data-testid="visible-range"
            className="font-sans text-[11px] font-semibold text-ink-450"
          >
            {rangeText}
          </span>
          {todayIdx >= 0 && (
            <button
              type="button"
              aria-label="Jump to today"
              onClick={jumpToToday}
              className="ml-auto rounded-card border border-edge-350 px-3 py-1.5 font-sans text-[11px] font-semibold text-ink-600"
            >
              Today
            </button>
          )}
        </div>
      )}

      {editor && (
        <CardEditor
          card={editor.mode === 'edit' ? editor.card : undefined}
          dayKey={editor.mode === 'create' ? editor.dayKey : undefined}
          defaultStartTime={editor.mode === 'create' ? editor.startTime : undefined}
          defaultDurationHours={editor.mode === 'create' ? editor.durationHours : undefined}
          dayCityName={
            editor.mode === 'create'
              ? cityByDay.get(editor.dayKey)?.name
              : cityByDay.get(editor.card.dayKey)?.name
          }
          onClose={() => setEditor(null)}
        />
      )}

      {accEditor && (
        <AccommodationEditor
          accommodation={accEditor.mode === 'edit' ? accEditor.accommodation : undefined}
          defaultStartNight={createStartNight}
          defaultEndNight={createStartNight}
          onClose={() => setAccEditor(null)}
        />
      )}

      {swapSourceDay && (
        <DaySwapModal
          sourceDay={swapSourceDay}
          days={days}
          cityByDay={cityByDay}
          onClose={() => setSwapSourceDayKey(null)}
          onConfirm={(targetDayKey) => {
            swapActivityDays(doc, swapSourceDay.key, targetDayKey)
            setSwapSourceDayKey(null)
          }}
        />
      )}
    </section>
  )
}
