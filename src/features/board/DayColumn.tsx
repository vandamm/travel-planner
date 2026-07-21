// A single day column on the board: a color-coded, city-labeled header above a
// continuous morning→evening time scale, with the day's cards laid out in the
// viewer's chosen direction. Purely presentational — it receives the resolved
// city and the day's cards as props so it is trivial to test and reuse (the
// mobile single-day view in Task 11 reuses the same card/scale logic).

import { useDroppable } from '@dnd-kit/core'
import { format, isWeekend, parseISO } from 'date-fns'
import type { Card as CardType, City, Day, DayCityOverride } from '../../data/schema'
import { NO_CITY_COLOR } from '../cities/colors'
import { CityPicker } from '../cities/CityPicker'
import { Card, SortableCard } from '../cards/Card'
import {
  PX_PER_HOUR,
  TIMELINE_VERTICAL_PADDING_PX,
  cardHeightPx,
  clockMinutes,
  resolvedDurationHours,
  windowHeightPx,
} from '../cards/cardHeight'
import { useDragPreview, useIsDragOverDay } from './dragOverDayContext'
import { dayDroppableId } from './dndHandlers'
import { TIME_SCALE, orderCardsForDirection, type TimeDirection } from './timeDirection'
import { COLUMN_WIDTH_REM } from './useViewport'

export interface DayColumnProps {
  day: Day
  /** Resolved city for the day, if any (drives the header color). */
  city?: City
  cards: CardType[]
  direction: TimeDirection
  /** Start of the day's timeline window, 'HH:mm' (sizes the body). */
  dayStart?: string
  /** End of the day's timeline window, 'HH:mm'. */
  dayEnd?: string
  /** All cities, to populate the per-day override picker (omit/empty → no picker). */
  cities?: City[]
  /** The day's *manual* override city id, if any (drives the picker value + flag). */
  overrideCityId?: DayCityOverride
  /** Set a city, choose explicit No city (`null`), or clear to Auto (`undefined`). */
  onSetCity?: (dayKey: string, cityId: DayCityOverride | undefined) => void
  /** Open the two-day activity swap workflow from this day. */
  onSwapDay?: (dayKey: string) => void
  /** Open the editor to add a card to this day. */
  onAddCard?: (dayKey: string, startTime?: string) => void
  /** Open the editor on an existing card. */
  onEditCard?: (card: CardType) => void
  /** The mobile view supplies its own compact day header. */
  showHeader?: boolean
}

function cardGapPx(
  card: CardType,
  direction: TimeDirection,
  dayStart: string,
  dayEnd: string,
  cursor: { current: number },
): number {
  const height = cardHeightPx(card, dayStart, dayEnd)
  if (!card.startTime) {
    cursor.current += height
    return 0
  }
  const start = clockMinutes(card.startTime)
  const top =
    direction === 'up'
      ? clockMinutes(dayEnd) - (start + resolvedDurationHours(card, dayStart, dayEnd) * 60)
      : start - clockMinutes(dayStart)
  const gap = Math.max((top / 60) * PX_PER_HOUR - cursor.current, 0)
  cursor.current += gap + height
  return gap
}

function overlappingCardIds(cards: CardType[], dayStart: string, dayEnd: string): Set<string> {
  const timed = cards.filter((card) => card.startTime)
  const conflicts = new Set<string>()
  for (let i = 0; i < timed.length; i += 1) {
    const a = timed[i]
    const aStart = clockMinutes(a.startTime!)
    const aEnd = aStart + resolvedDurationHours(a, dayStart, dayEnd) * 60
    for (let j = i + 1; j < timed.length; j += 1) {
      const b = timed[j]
      const bStart = clockMinutes(b.startTime!)
      const bEnd = bStart + resolvedDurationHours(b, dayStart, dayEnd) * 60
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.add(a.id)
        conflicts.add(b.id)
      }
    }
  }
  return conflicts
}

export function DayColumn({
  day,
  city,
  cards,
  direction,
  dayStart = '06:00',
  dayEnd = '21:00',
  cities = [],
  overrideCityId,
  onSetCity,
  onSwapDay,
  onAddCard,
  onEditCard,
  showHeader = true,
}: DayColumnProps) {
  const ordered = orderCardsForDirection(cards, direction)
  const conflicts = overlappingCardIds(cards, dayStart, dayEnd)
  const scale = direction === 'up' ? [...TIME_SCALE].reverse() : [...TIME_SCALE]
  const cardCursor = { current: 0 }
  const weekday = format(parseISO(day.key), 'EEE').toUpperCase()
  const dateLabel = format(parseISO(day.key), 'dd MMM').toUpperCase()
  const weekend = isWeekend(parseISO(day.key))

  const timelineHeight = windowHeightPx(dayStart, dayEnd)

  // The column body is a drop target so cards can be dropped onto an empty day
  // (or its blank space), not only onto another card.
  const { setNodeRef } = useDroppable({ id: dayDroppableId(day.key) })
  // Highlight this column while a card is dragged over it — the "lands here" hint.
  const dragOver = useIsDragOverDay(day.key)
  const dragPreview = useDragPreview()
  const previewTopPx =
    dragPreview?.dayKey === day.key && dragPreview.startTime
      ? ((direction === 'up'
          ? clockMinutes(dayEnd) -
            (clockMinutes(dragPreview.startTime) + dragPreview.durationHours * 60)
          : clockMinutes(dragPreview.startTime) - clockMinutes(dayStart)) /
          60) *
        PX_PER_HOUR
      : 0

  return (
    <section
      data-testid="day-column"
      data-day={day.key}
      data-drag-over={dragOver ? '' : undefined}
      aria-label={`${weekday} ${dateLabel}${city ? ` — ${city.name}` : ''}`}
      style={{ width: COLUMN_WIDTH_REM }}
      className={`flex shrink-0 flex-col bg-white ${dragOver ? 'ring-2 ring-sky-300' : ''}`}
    >
      {showHeader && (
        <header>
          <div className="flex flex-col gap-0.5 px-3 pb-2 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span
                data-testid="day-label"
                className={`text-[9.5px] font-extrabold uppercase tracking-[0.18em] ${weekend ? 'text-city-vermilion' : 'text-ink-400'}`}
              >
                {weekday} · {dateLabel}
              </span>
              {onSwapDay && (
                <button
                  type="button"
                  onClick={() => onSwapDay(day.key)}
                  className="text-[10px] font-semibold text-ink-400 underline decoration-edge-300 underline-offset-2 hover:text-ink-600"
                >
                  Swap day
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span
                data-testid="city-name"
                className="font-serif text-lg font-bold leading-tight text-ink"
              >
                {city ? city.name : <span className="text-ink-300">No city</span>}
              </span>
              {cities.length > 0 && (
                <CityPicker
                  label="Choose city"
                  value={overrideCityId}
                  resolvedCityId={city?.id}
                  cities={cities}
                  includeNoCity
                  bareEdit
                  onChange={(cityId) => onSetCity?.(day.key, cityId)}
                />
              )}
            </div>
          </div>
          <div
            data-testid="city-band"
            style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
            className="h-[3px] w-full"
          />
        </header>
      )}

      <div
        data-testid="day-body"
        style={{ height: timelineHeight + TIMELINE_VERTICAL_PADDING_PX * 2 }}
        className="relative px-3"
      >
        {/* Labels occupy the reserved outer padding, outside the activity track. */}
        <ol
          data-testid="scale"
          aria-hidden
          className="pointer-events-none absolute inset-x-0 inset-y-0 flex flex-col justify-between"
        >
          {scale.map((label) => (
            <li
              key={label}
              data-testid="scale-label"
              className="text-center text-[10px] font-semibold uppercase tracking-wide text-ink-300"
            >
              {label}
            </li>
          ))}
        </ol>
        <div
          ref={setNodeRef}
          data-testid="timeline-track"
          style={{ top: TIMELINE_VERTICAL_PADDING_PX, height: timelineHeight }}
          className="absolute left-3 right-3"
        >
          <ol data-testid="card-list" className="relative z-10 flex flex-col pl-0">
            {ordered.map((c) => {
              const gap = cardGapPx(c, direction, dayStart, dayEnd, cardCursor)
              return (
                <SortableCard
                  key={c.id}
                  card={c}
                  conflict={conflicts.has(c.id)}
                  onEdit={onEditCard}
                  dayStart={dayStart}
                  dayEnd={dayEnd}
                  direction={direction}
                  layoutStyle={{ height: cardHeightPx(c, dayStart, dayEnd), marginTop: gap }}
                />
              )
            })}
          </ol>

          {dragPreview?.dayKey === day.key && (
            <div
              data-testid="drag-preview-card"
              style={{
                top: previewTopPx,
                height: dragPreview.durationHours * PX_PER_HOUR,
              }}
              className="pointer-events-none absolute inset-x-0 z-20"
            >
              <Card
                card={dragPreview.card}
                dayStart={dayStart}
                dayEnd={dayEnd}
                timingPreview={dragPreview}
              />
            </div>
          )}
        </div>
      </div>

      <footer className="px-3 pb-3 pt-1">
        <button
          type="button"
          aria-label="Add activity"
          onClick={() => onAddCard?.(day.key)}
          className="w-full rounded border border-dashed border-edge-300 px-2 py-1 font-serif text-xs italic text-ink-500 hover:border-ink-300 hover:text-ink-600"
        >
          + add activity
        </button>
      </footer>
    </section>
  )
}
