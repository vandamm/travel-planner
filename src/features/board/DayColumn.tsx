// A single day column on the board: a color-coded, city-labeled header above a
// continuous morning→evening time scale, with the day's cards laid out in the
// viewer's chosen direction. Purely presentational — it receives the resolved
// city and the day's cards as props so it is trivial to test and reuse (the
// mobile single-day view in Task 11 reuses the same card/scale logic).

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { format, parseISO } from 'date-fns'
import type { Card as CardType, City, Day } from '../../data/schema'
import { SortableCard } from '../cards/Card'
import { dayDroppableId } from './dndHandlers'
import { TIME_SCALE, orderCardsForDirection, type TimeDirection } from './timeDirection'

export interface DayColumnProps {
  day: Day
  /** Resolved city for the day, if any (drives the header color). */
  city?: City
  cards: CardType[]
  direction: TimeDirection
  /** Open the editor to add a card to this day. */
  onAddCard?: (dayKey: string) => void
  /** Open the editor on an existing card. */
  onEditCard?: (card: CardType) => void
}

/** A neutral band color for days with no resolved city (travel days). */
const NO_CITY_COLOR = '#cbd5e1' // slate-300

export function DayColumn({ day, city, cards, direction, onAddCard, onEditCard }: DayColumnProps) {
  const ordered = orderCardsForDirection(cards, direction)
  const scale = direction === 'up' ? [...TIME_SCALE].reverse() : [...TIME_SCALE]
  const weekday = format(parseISO(day.key), 'EEE')
  const dateLabel = format(parseISO(day.key), 'd MMM')

  // The column body is a drop target so cards can be dropped onto an empty day
  // (or its blank space), not only onto another card.
  const { setNodeRef } = useDroppable({ id: dayDroppableId(day.key) })

  return (
    <section
      data-testid="day-column"
      data-day={day.key}
      aria-label={`${weekday} ${dateLabel}${city ? ` — ${city.name}` : ''}`}
      className="flex w-56 shrink-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header className="overflow-hidden rounded-t-lg">
        <div
          data-testid="city-band"
          style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
          className="h-1.5 w-full"
        />
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {weekday} · {dateLabel}
          </span>
          <span
            data-testid="city-name"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"
          >
            <span
              aria-hidden
              style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
              className="inline-block h-2.5 w-2.5 rounded-full"
            />
            {city ? city.name : <span className="text-slate-400">No city</span>}
          </span>
        </div>
      </header>

      <div ref={setNodeRef} className="relative flex-1 px-3 py-2">
        <ol data-testid="scale" className="pointer-events-none absolute inset-0 flex flex-col">
          {scale.map((label) => (
            <li
              key={label}
              data-testid="scale-label"
              className="flex flex-1 items-start justify-end px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300"
            >
              {label}
            </li>
          ))}
        </ol>

        <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ol className="relative flex flex-col gap-2">
            {ordered.map((c) => (
              <li key={c.id}>
                <SortableCard card={c} onEdit={onEditCard} />
              </li>
            ))}
          </ol>
        </SortableContext>
      </div>

      <footer className="px-3 pb-3 pt-1">
        <button
          type="button"
          aria-label={`Add card to ${weekday} ${dateLabel}`}
          onClick={() => onAddCard?.(day.key)}
          className="w-full rounded border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          + Add card
        </button>
      </footer>
    </section>
  )
}
