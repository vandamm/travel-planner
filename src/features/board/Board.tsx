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
import { useRoom } from '../../data/RoomProvider'
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
import { useTimeDirection } from './useTimeDirection'
import { useUndoManager } from './undoManager'
import { useColumnsThatFit, useViewport } from './useViewport'

/** Which card the editor is open on: a new card on a day, or an existing card. */
type EditorState = { mode: 'create'; dayKey: string } | { mode: 'edit'; card: Card }

/** Which stay the accommodation editor is open on: a new one (optionally seeded
 * with a first night), or an existing one. */
type AccEditorState =
  | { mode: 'create'; startNight?: string }
  | { mode: 'edit'; accommodation: Accommodation }

export interface BoardProps {
  /** Bumped by the mobile ≡ menu's "Add stay"; each change opens the create
   *  editor (a nonce, not a boolean, so repeated taps re-open it). */
  addStayNonce?: number
}

export function Board({ addStayNonce = 0 }: BoardProps) {
  const { doc } = useRoom()
  useDocVersion(doc)
  const { direction, toggle } = useTimeDirection()
  const { undo, redo, canUndo, canRedo } = useUndoManager(doc)
  const viewport = useViewport()
  const columns = useColumnsThatFit()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [accEditor, setAccEditor] = useState<AccEditorState | null>(null)
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
  const days = generateDays(trip.startDate, trip.numDays)
  const accommodations = listAccommodations(doc)
  const overrides = listDayOverrides(doc)
  const cities = listCities(doc)
  const cityById = new Map(cities.map((c) => [c.id, c]))

  const cardsByDay = new Map<string, Card[]>()
  for (const card of listCards(doc)) {
    const list = cardsByDay.get(card.dayKey)
    if (list) list.push(card)
    else cardsByDay.set(card.dayKey, [card])
  }

  // Recompute the fade + range label whenever the board's content or the viewport
  // changes. Runs only when the desktop scroll container is mounted (mobile leaves
  // scrollRef null). Mirrors MobileDayView's scroll-hint effect.
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
    <section aria-labelledby="board-heading" className="flex flex-col gap-3">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6">
        <h2 id="board-heading" className="text-lg font-semibold text-ink">
          Board
        </h2>
        <div className="flex items-center gap-2">
          {/* Multi-week navigation is desktop-only: the scrolling columns row lives
              in the desktop branch; mobile pages one day at a time (pager dots). */}
          {viewport === 'desktop' && days.length > 0 && (
            <>
              {todayIdx >= 0 && (
                <button
                  type="button"
                  aria-label="Jump to today"
                  onClick={jumpToToday}
                  className="rounded border border-edge-300 bg-white px-3 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip"
                >
                  Today
                </button>
              )}
              <div data-testid="range-stepper" className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous days"
                  onClick={() => pageBy(-1)}
                  className="rounded border border-edge-300 bg-white px-2 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip"
                >
                  ‹
                </button>
                <span
                  data-testid="visible-range"
                  className="min-w-[7rem] text-center text-sm font-medium text-ink-600"
                >
                  {rangeText}
                </span>
                <button
                  type="button"
                  aria-label="Next days"
                  onClick={() => pageBy(1)}
                  className="rounded border border-edge-300 bg-white px-2 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip"
                >
                  ›
                </button>
              </div>
            </>
          )}
          {/* Live undo/redo for hand edits (Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z), also
              tappable on mobile. Disabled when the stack is empty; agent writes /
              restores run under APPLY_TRIP_ORIGIN and stay off this stack. */}
          <button
            type="button"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
            className="rounded border border-edge-300 bg-white px-3 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden>↶</span>
          </button>
          <button
            type="button"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
            className="rounded border border-edge-300 bg-white px-3 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden>↷</span>
          </button>
          {/* Desktop's "Add stay" lives at the right end of the stays lane; mobile
              reaches it through the header ≡ menu (lifted to AppShell via nonce). */}
          <button
            type="button"
            aria-label="Toggle time direction"
            aria-pressed={direction === 'up'}
            onClick={toggle}
            className="rounded border border-edge-300 bg-white px-3 py-1 text-sm font-medium text-ink-600 hover:bg-surface-chip"
          >
            {direction === 'down' ? 'Morning → Evening' : 'Evening → Morning'}
          </button>
        </div>
      </div>

      {days.length === 0 ? (
        <p data-testid="board-empty" className="px-6 text-ink-500">
          Set a start date and number of days to build the board.
        </p>
      ) : viewport === 'mobile' ? (
        // Below the laptop breakpoint: one day at a time, paged by swipe or the
        // prev/next controls. Same cards/accommodation/direction logic as desktop.
        <BoardDnd doc={doc} direction={direction}>
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
            onAddCard={(dayKey) => setEditor({ mode: 'create', dayKey })}
            onEditCard={(card) => setEditor({ mode: 'edit', card })}
            onSetCity={(dayKey, cityId) => setDayCityOverride(doc, dayKey, cityId)}
          />
        </BoardDnd>
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
            <BoardDnd doc={doc} direction={direction}>
              <div data-testid="board" className="flex gap-3">
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
                      onAddCard={(dayKey) => setEditor({ mode: 'create', dayKey })}
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
