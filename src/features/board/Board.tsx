// The board: a horizontally scrolling row of day columns. It owns all the doc
// reads for the board view (trip → days, accommodations + overrides → each day's
// resolved city, cities → colors, cards grouped by day) and renders a
// presentational <DayColumn> per day. The morning↔evening direction toggle is a
// per-user view preference (localStorage), so it lives here, not in the doc.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  getTrip,
  listAccommodations,
  listCards,
  listCities,
  listDayOverrides,
  setDayCityOverride,
} from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import { useDocVersion } from '../../data/useDoc'
import { firstUncoveredDay, resolveDayCity } from '../../data/cityResolution'
import { generateDays, toDayKey } from '../../data/days'
import { COLUMN_STRIDE_PX, rangeLabel, showRightFade, todayIndex } from './multiWeekNav'
import type { Accommodation, Card } from '../../data/schema'
import { AccommodationEditor } from '../accommodation/AccommodationEditor'
import { AccommodationLane } from '../accommodation/AccommodationLane'
import { CardEditor } from '../cards/CardEditor'
import { BoardDnd } from './dndContext'
import { DayColumn } from './DayColumn'
import { MobileDayView } from './MobileDayView'
import { BoardToolbar } from './BoardToolbar'
import { BoardEmptyState } from './BoardEmptyState'
import { useTimeDirection } from './useTimeDirection'
import { useUndoManager } from './undoManager'
import { COLUMN_GAP_REM, useColumnsThatFit, useViewport } from './useViewport'

/** Which card the editor is open on: a new card on a day, or an existing card. */
type EditorState = { mode: 'create'; dayKey: string; startTime?: string } | { mode: 'edit'; card: Card }

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
  const { direction, toggle } = useTimeDirection()
  const { undo, redo, canUndo, canRedo } = useUndoManager(doc)
  const viewport = useViewport()
  const columns = useColumnsThatFit()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [accEditor, setAccEditor] = useState<AccEditorState | null>(null)
  // Render the completed atomic drag transaction immediately; the normal doc
  // subscription still handles edits made through every other path.
  const [, rerenderAfterDrop] = useState(0)
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

  const cardsByDay = new Map<string, Card[]>()
  for (const card of listCards(doc)) {
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
      setRangeText(rangeLabel(days, el))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
    // Horizontal geometry + the label depend on the days, not per-card content.
  }, [viewport, days])

  const todayIdx = todayIndex(days, toDayKey(new Date()))
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
      className="mx-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-frame border border-ink-frame bg-white min-[400px]:mx-6"
    >
      <BoardToolbar
        title={wordmark}
        meta={meta}
        status={status}
        presences={presences}
        onOpenTrip={onOpenTrip}
        onOpenCities={onOpenCities}
        onOpenShare={onOpenShare}
        onOpenMenu={onOpenMenu}
        onAddStay={() => setAccEditor({ mode: 'create' })}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        direction={direction}
        onToggleDirection={toggle}
      />
      {viewport === 'desktop' && days.length > 0 && (
        <div className="flex items-center justify-end gap-2 px-4 py-2">
          {todayIdx >= 0 && (
            <button type="button" aria-label="Jump to today" onClick={jumpToToday} className="button-label rounded-card border border-edge-350 px-3 py-2 text-ink-600">
              Today
            </button>
          )}
          <div data-testid="range-stepper" className="flex items-center gap-1">
            <button type="button" aria-label="Previous days" onClick={() => pageBy(-1)} className="h-7 w-7 rounded-card border border-edge-350 text-ink-600">‹</button>
            <span data-testid="visible-range" className="min-w-[7rem] text-center text-sm font-medium text-ink-600">{rangeText}</span>
            <button type="button" aria-label="Next days" onClick={() => pageBy(1)} className="h-7 w-7 rounded-card border border-edge-350 text-ink-600">›</button>
          </div>
        </div>
      )}

      {days.length === 0 ? (
        <BoardEmptyState onOpenTrip={onOpenTrip} />
      ) : viewport === 'mobile' ? (
        // Below 640px: one day at a time, paged by swipe or the
        // prev/next controls. Same cards/accommodation/direction logic as desktop.
        <div className="min-h-0 flex-1">
          <BoardDnd
            doc={doc}
            direction={direction}
            dayStart={trip.dayStart}
            dayEnd={trip.dayEnd}
            onDrop={() => rerenderAfterDrop((version) => version + 1)}
          >
            <MobileDayView
              days={days}
              cardsByDay={cardsByDay}
              accommodations={accommodations}
              overrides={overrides}
              cityById={cityById}
              cities={cities}
              direction={direction}
              dayStart={trip.dayStart}
              dayEnd={trip.dayEnd}
              columns={columns}
              onAddCard={(dayKey, startTime) => setEditor({ mode: 'create', dayKey, startTime })}
              onEditCard={(card) => setEditor({ mode: 'edit', card })}
              onSetCity={(dayKey, cityId) => setDayCityOverride(doc, dayKey, cityId)}
              onEditAccommodation={(accommodation) => setAccEditor({ mode: 'edit', accommodation })}
              onAddStay={(startNight) => setAccEditor({ mode: 'create', startNight })}
              onOpenCities={onOpenCities}
            />
          </BoardDnd>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={scrollRef}
            data-testid="board-scroll"
            onScroll={(e) => {
              setShowFade(showRightFade(e.currentTarget))
              setRangeText(rangeLabel(days, e.currentTarget))
            }}
            className="overflow-x-auto px-6 pb-4"
          >
            <AccommodationLane
              days={days}
              accommodations={accommodations}
              cityById={cityById}
              onEditAccommodation={(accommodation) => setAccEditor({ mode: 'edit', accommodation })}
              onAddStay={(startNight) => setAccEditor({ mode: 'create', startNight })}
            />
            <BoardDnd
              doc={doc}
              direction={direction}
              dayStart={trip.dayStart}
              dayEnd={trip.dayEnd}
              onDrop={() => rerenderAfterDrop((version) => version + 1)}
            >
              <div data-testid="board" className="flex" style={{ gap: COLUMN_GAP_REM }}>
                {days.map((day) => {
                  const cityId = resolveDayCity(day.key, accommodations, overrides)
                  return (
                    <DayColumn
                      key={day.key}
                      day={day}
                      city={cityId ? cityById.get(cityId) : undefined}
                      cards={cardsByDay.get(day.key) ?? []}
                      direction={direction}
                      dayStart={trip.dayStart}
                      dayEnd={trip.dayEnd}
                      cities={cities}
                      overrideCityId={overrides[day.key]}
                      onSetCity={(dayKey, cityId) => setDayCityOverride(doc, dayKey, cityId)}
                      onAddCard={(dayKey, startTime) => setEditor({ mode: 'create', dayKey, startTime })}
                      onEditCard={(card) => setEditor({ mode: 'edit', card })}
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

      {editor && (
        <CardEditor
          card={editor.mode === 'edit' ? editor.card : undefined}
          dayKey={editor.mode === 'create' ? editor.dayKey : undefined}
          defaultStartTime={editor.mode === 'create' ? editor.startTime : undefined}
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
    </section>
  )
}
