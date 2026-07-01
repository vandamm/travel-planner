// The board: a horizontally scrolling row of day columns. It owns all the doc
// reads for the board view (trip → days, accommodations + overrides → each day's
// resolved city, cities → colors, cards grouped by day) and renders a
// presentational <DayColumn> per day. The morning↔evening direction toggle is a
// per-user view preference (localStorage), so it lives here, not in the doc.

import { useEffect, useState } from 'react'
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
import { generateDays } from '../../data/days'
import type { Accommodation, Card } from '../../data/schema'
import { AccommodationEditor } from '../accommodation/AccommodationEditor'
import { AccommodationLane } from '../accommodation/AccommodationLane'
import { CardEditor } from '../cards/CardEditor'
import { BoardDnd } from './dndContext'
import { DayColumn } from './DayColumn'
import { MobileDayView } from './MobileDayView'
import { useTimeDirection } from './useTimeDirection'
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
  const viewport = useViewport()
  const columns = useColumnsThatFit()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [accEditor, setAccEditor] = useState<AccEditorState | null>(null)

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

  // New stay defaults to the gap button's day, else the first uncovered night,
  // else the trip start. End mirrors start (one night) — the editor chains the
  // last-night picker from there.
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
        <div className="overflow-x-auto px-6 pb-4">
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
