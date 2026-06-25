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
import type { Card } from '../../data/schema'
import { CardEditor } from '../cards/CardEditor'
import { BoardDnd } from './dndContext'
import { DayColumn } from './DayColumn'
import { useTimeDirection } from './useTimeDirection'

/** Which card the editor is open on: a new card on a day, or an existing card. */
type EditorState = { mode: 'create'; dayKey: string } | { mode: 'edit'; card: Card }

export function Board() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const { direction, toggle } = useTimeDirection()
  const [editor, setEditor] = useState<EditorState | null>(null)

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

      {days.length === 0 ? (
        <p data-testid="board-empty" className="px-6 text-slate-500">
          Set a start date and number of days to build the board.
        </p>
      ) : (
        <BoardDnd doc={doc} direction={direction}>
          <div data-testid="board" className="flex gap-3 overflow-x-auto px-6 pb-4">
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
      )}

      {editor && (
        <CardEditor
          card={editor.mode === 'edit' ? editor.card : undefined}
          dayKey={editor.mode === 'create' ? editor.dayKey : undefined}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  )
}
