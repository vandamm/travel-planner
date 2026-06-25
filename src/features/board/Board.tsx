// The board: a horizontally scrolling row of day columns. It owns all the doc
// reads for the board view (trip → days, accommodations + overrides → each day's
// resolved city, cities → colors, cards grouped by day) and renders a
// presentational <DayColumn> per day. The morning↔evening direction toggle is a
// per-user view preference (localStorage), so it lives here, not in the doc.

import { useState } from 'react'
import {
  getTrip,
  listAccommodations,
  listCards,
  listCities,
  listDayOverrides,
} from '../../data/doc'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'
import { resolveDayCity } from '../../data/cityResolution'
import { generateDays } from '../../data/days'
import type { Accommodation, Card } from '../../data/schema'
import { AccommodationEditor } from '../accommodation/AccommodationEditor'
import { AccommodationLane } from '../accommodation/AccommodationLane'
import { CardEditor } from '../cards/CardEditor'
import { BoardDnd } from './dndContext'
import { DayColumn } from './DayColumn'
import { useTimeDirection } from './useTimeDirection'

/** Which card the editor is open on: a new card on a day, or an existing card. */
type EditorState = { mode: 'create'; dayKey: string } | { mode: 'edit'; card: Card }

/** Which stay the accommodation editor is open on: a new one, or an existing one. */
type AccEditorState = { mode: 'create' } | { mode: 'edit'; accommodation: Accommodation }

export function Board() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const { direction, toggle } = useTimeDirection()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [accEditor, setAccEditor] = useState<AccEditorState | null>(null)

  const trip = getTrip(doc)
  const days = generateDays(trip.startDate, trip.numDays)
  const accommodations = listAccommodations(doc)
  const overrides = listDayOverrides(doc)
  const cityById = new Map(listCities(doc).map((c) => [c.id, c]))

  const cardsByDay = new Map<string, Card[]>()
  for (const card of listCards(doc)) {
    const list = cardsByDay.get(card.dayKey)
    if (list) list.push(card)
    else cardsByDay.set(card.dayKey, [card])
  }

  return (
    <section aria-labelledby="board-heading" className="flex flex-col gap-3">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6">
        <h2 id="board-heading" className="text-lg font-semibold text-slate-800">
          Board
        </h2>
        <div className="flex items-center gap-2">
          {days.length > 0 && (
            <button
              type="button"
              aria-label="Add stay"
              onClick={() => setAccEditor({ mode: 'create' })}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Add stay
            </button>
          )}
          <button
            type="button"
            aria-label="Toggle time direction"
            aria-pressed={direction === 'up'}
            onClick={toggle}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {direction === 'down' ? 'Morning → Evening' : 'Evening → Morning'}
          </button>
        </div>
      </div>

      {days.length === 0 ? (
        <p data-testid="board-empty" className="px-6 text-slate-500">
          Set a start date and number of days to build the board.
        </p>
      ) : (
        <div className="overflow-x-auto px-6 pb-4">
          <AccommodationLane
            days={days}
            accommodations={accommodations}
            cityById={cityById}
            onEditAccommodation={(accommodation) => setAccEditor({ mode: 'edit', accommodation })}
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
          defaultStartNight={trip.startDate || days[0]?.key}
          defaultEndNight={trip.startDate || days[0]?.key}
          onClose={() => setAccEditor(null)}
        />
      )}
    </section>
  )
}
