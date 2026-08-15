// A single day column on the board: a color-coded, city-labeled header above a
// continuous morning→evening time scale, with the day's cards laid out along it.
// Purely presentational — it receives the resolved
// city and the day's cards as props so it is trivial to test and reuse (the
// mobile single-day view reuses the same card/scale logic).
//
// Empty time renders as nothing (v4): the two-hourly rails carry the scale, and
// hovering a gap of 45 minutes or more floats a one-hour "＋ plan something"
// band under the cursor. Adding an activity outright is the bare ＋ in the header.

import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { isWeekend, parseISO } from 'date-fns'
import {
  formatDay,
  formatDayOfMonth,
  formatMonthShort,
  formatWeekday,
} from '../../data/dateFormat'
import type { Card as CardType, City, Day, DayCityOverride } from '../../data/schema'
import { NO_CITY_COLOR } from '../cities/colors'
import { CityPicker } from '../cities/CityPicker'
import { Card, SortableCard } from '../cards/Card'
import {
  cardHeightPx,
  clockMinutes,
  evenHourMarks,
  resolvedDurationHours,
  windowHeightPx,
} from '../cards/cardHeight'
import { travelBandLabel, travelLeadMinutes } from '../cards/travelTime'
import { useDragPreview, useIsDragOverDay } from './dragOverDayContext'
import { dayDroppableId } from './dndHandlers'
import { planBandHeightPx, planBandTiming, planBandTopPx, showsPlanBand } from './planBand'
import { freeTimelineSlots, layoutTimelineCards } from './timelineSlots'
import { usePxPerHour } from './timelineScale'
import { COLUMN_WIDTH_REM } from './useViewport'

export interface DayColumnProps {
  day: Day
  /** Resolved city for the day, if any (drives the header color). */
  city?: City
  cards: CardType[]
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
  /** Open the editor to add a card to this day, optionally pre-timed. */
  onAddCard?: (dayKey: string, startTime?: string, durationHours?: number) => void
  /** Open the editor on an existing card. */
  onEditCard?: (card: CardType) => void
  /** The mobile view supplies its own compact day header. */
  showHeader?: boolean
  /** Draw travel lead-ins as bands (and count their time); off shows badges. */
  showTravelTimes?: boolean
  /**
   * Offset (px) of the now-line within the day window; omit to hide it. The
   * line runs across every visible column, not just today's — only the pill in
   * the gutter and the header's TODAY badge single today out.
   */
  nowOffsetPx?: number
  /** This column is today: carry the TODAY pill. */
  isToday?: boolean
  /** Draw the boundary hairline on the left edge too (the board's first column). */
  firstColumn?: boolean
  /** Show the month beside the date — the board's first column, and each 1st. */
  showMonth?: boolean
  /**
   * Fill the space available instead of holding the desktop minimum width. The
   * mobile single-day view is narrower than one board column, so it would
   * otherwise overflow the phone sideways.
   */
  fluid?: boolean
}

/** The two-hourly horizontal rails that carry the scale now the word labels are gone. */
function GridRails({ dayStart, dayEnd }: { dayStart: string; dayEnd: string }) {
  const pxPerHour = usePxPerHour()
  const start = clockMinutes(dayStart)
  return (
    <div aria-hidden data-testid="grid-rails" className="pointer-events-none absolute inset-0 z-0">
      {evenHourMarks(dayStart, dayEnd).map((hour, index) => (
        <span
          key={hour}
          data-testid="grid-rail"
          style={{ top: ((hour * 60 - start) / 60) * pxPerHour }}
          className={`absolute inset-x-0 h-px ${index === 0 ? 'bg-hour-rule' : 'bg-hour-grid'}`}
        />
      ))}
    </div>
  )
}

/**
 * Which timed cards collide. The travel lead-in counts: two activities can clash
 * through the drive alone — you cannot be setting off for the second while still
 * inside the first — and that is exactly the clash the Overlap badge is for.
 */
function overlappingCardIds(
  cards: CardType[],
  dayStart: string,
  dayEnd: string,
  showTravelTimes: boolean,
): Set<string> {
  const timed = cards.filter((card) => card.startTime)
  const conflicts = new Set<string>()
  const span = (card: CardType) => {
    const start = clockMinutes(card.startTime!)
    return {
      start: start - travelLeadMinutes(card, showTravelTimes),
      end: start + resolvedDurationHours(card, dayStart, dayEnd) * 60,
    }
  }
  for (let i = 0; i < timed.length; i += 1) {
    const a = timed[i]
    const { start: aStart, end: aEnd } = span(a)
    for (let j = i + 1; j < timed.length; j += 1) {
      const b = timed[j]
      const { start: bStart, end: bEnd } = span(b)
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.add(a.id)
        conflicts.add(b.id)
      }
    }
  }
  return conflicts
}

/**
 * One free gap. It renders nothing at rest; on hover (or keyboard focus) it
 * floats the one-hour band, tracked to the pointer by `planBandTopPx`. Gaps
 * under 45 minutes render no affordance at all.
 */
function PlanSlot({
  slot,
  top,
  height,
  onAdd,
}: {
  slot: { startTime: string; endTime: string }
  top: number
  height: number
  onAdd: (startTime: string, durationHours: number) => void
}) {
  const pxPerHour = usePxPerHour()
  const [bandTop, setBandTop] = useState(0)
  const bandHeight = planBandHeightPx(height, pxPerHour)

  return (
    <button
      type="button"
      data-testid="timeline-slot"
      aria-label={`Plan something between ${slot.startTime} and ${slot.endTime}`}
      onPointerMove={(event) =>
        setBandTop(
          planBandTopPx(
            event.clientY - event.currentTarget.getBoundingClientRect().top,
            height,
            pxPerHour,
          ),
        )
      }
      onClick={() => {
        const timing = planBandTiming(slot.startTime, slot.endTime, bandTop, pxPerHour)
        onAdd(timing.startTime, timing.durationHours)
      }}
      style={{ top, height }}
      className="group absolute inset-x-1.5 z-0 cursor-pointer"
    >
      <span
        data-testid="plan-band"
        style={{ top: bandTop, height: bandHeight }}
        className="pointer-events-none absolute inset-x-0 hidden items-center justify-center rounded-card border border-dashed border-edge-plan group-hover:flex group-focus-visible:flex"
      >
        <span className="whitespace-nowrap font-serif text-[12.5px] font-medium italic leading-none text-hour-text">
          ＋ plan something
        </span>
      </span>
    </button>
  )
}

export function DayColumn({
  day,
  city,
  cards,
  dayStart = '06:00',
  dayEnd = '21:00',
  cities = [],
  overrideCityId,
  onSetCity,
  onSwapDay,
  onAddCard,
  onEditCard,
  showHeader = true,
  showTravelTimes = true,
  nowOffsetPx,
  isToday = false,
  firstColumn = false,
  showMonth = false,
  fluid = false,
}: DayColumnProps) {
  const pxPerHour = usePxPerHour()
  const placements = layoutTimelineCards(cards, dayStart, dayEnd, showTravelTimes)
  const freeSlots = freeTimelineSlots(cards, dayStart, dayEnd, showTravelTimes)
  const conflicts = overlappingCardIds(cards, dayStart, dayEnd, showTravelTimes)
  const date = parseISO(day.key)
  const weekday = formatWeekday(day.key)
  const dateLabel = formatDay(day.key)
  const weekend = isWeekend(date)

  const timelineHeight = windowHeightPx(dayStart, dayEnd, pxPerHour)

  // The column body is a drop target so cards can be dropped onto an empty day
  // (or its blank space), not only onto another card.
  const { setNodeRef } = useDroppable({ id: dayDroppableId(day.key) })
  // Highlight this column while a card is dragged over it — the "lands here" hint.
  const dragOver = useIsDragOverDay(day.key)
  const dragPreview = useDragPreview()
  const previewTopPx =
    dragPreview?.dayKey === day.key && dragPreview.startTime
      ? ((clockMinutes(dragPreview.startTime) - clockMinutes(dayStart)) / 60) * pxPerHour
      : 0

  return (
    <section
      data-testid="day-column"
      data-day={day.key}
      data-today={isToday ? '' : undefined}
      data-drag-over={dragOver ? '' : undefined}
      aria-label={`${weekday} ${dateLabel}${city ? ` — ${city.name}` : ''}`}
      style={
        fluid
          ? { flex: '1 1 0', minWidth: 0 }
          : { flex: `1 0 ${COLUMN_WIDTH_REM}`, minWidth: COLUMN_WIDTH_REM }
      }
      // The boundary hairline is on the column itself, so it runs unbroken from
      // the header row down through the whole grid.
      className={`flex shrink-0 flex-col border-r border-edge-divider bg-white ${firstColumn ? 'border-l' : ''} ${dragOver ? 'ring-2 ring-inset ring-sky-300' : ''}`}
    >
      {showHeader && (
        <header>
          <div className="flex flex-col gap-0.5 px-[13px] pb-0 pt-[11px]">
            <div className="flex items-baseline gap-[7px]">
              {/* The date is set as a large day-of-month flanked by a small
                  weekday and month; the month shows only where it changes. */}
              <span data-testid="day-label" className="flex items-baseline gap-[7px]">
                <span
                  className={`text-[9.5px] font-extrabold uppercase tracking-[0.16em] ${weekend ? 'text-city-vermilion' : 'text-ink-400'}`}
                >
                  {weekday}
                </span>
                <span
                  className={`font-serif text-[21px] font-bold leading-none ${weekend ? 'text-city-vermilion' : 'text-ink'}`}
                >
                  {formatDayOfMonth(day.key)}
                </span>
                {showMonth && (
                  <span
                    data-testid="day-month"
                    className={`text-[9.5px] font-bold uppercase tracking-[0.06em] ${weekend ? 'text-city-vermilion' : 'text-ink-400'}`}
                  >
                    {formatMonthShort(day.key)}
                  </span>
                )}
              </span>
              {isToday && (
                <span
                  data-testid="today-pill"
                  className="rounded-chip bg-city-vermilion px-[5px] py-[2px] font-sans text-[8.5px] font-extrabold uppercase leading-none tracking-[0.1em] text-white"
                >
                  Today
                </span>
              )}
              <span className="flex-1" />
              {onAddCard && (
                <button
                  type="button"
                  aria-label={`Add activity to ${weekday} ${dateLabel}`}
                  title="Add activity to this day"
                  onClick={() => onAddCard(day.key)}
                  className="self-center font-sans text-[17px] font-semibold leading-none text-ink-200 transition-[color,transform] duration-150 ease-out hover:scale-[1.15] hover:text-city-vermilion"
                >
                  <span aria-hidden>+</span>
                </button>
              )}
              {onSwapDay && (
                <button
                  type="button"
                  aria-label="Swap day"
                  title="Swap day"
                  onClick={() => onSwapDay(day.key)}
                  className="self-center font-sans text-[13px] leading-none text-ink-200 hover:text-ink-600"
                >
                  <span aria-hidden>⇄</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                data-testid="city-name"
                className="font-serif text-[16px] font-semibold leading-tight text-ink"
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
            className="mt-[9px] h-1 w-full"
          />
        </header>
      )}

      {/* The body is exactly the window's height: the last rail sits on its
          bottom edge, with no dead space under it. */}
      <div data-testid="day-body" style={{ height: timelineHeight }} className="relative">
        <div
          ref={setNodeRef}
          data-testid="timeline-track"
          style={{ height: timelineHeight }}
          className="absolute inset-x-0 top-0"
        >
          <GridRails dayStart={dayStart} dayEnd={dayEnd} />

          {onAddCard &&
            freeSlots
              .filter((slot) => showsPlanBand(slot.startTime, slot.endTime))
              .map((slot) => {
                const start = clockMinutes(slot.startTime)
                const end = clockMinutes(slot.endTime)
                const offset = start - clockMinutes(dayStart)
                return (
                  <PlanSlot
                    key={`${slot.startTime}-${slot.endTime}`}
                    slot={slot}
                    top={(offset / 60) * pxPerHour}
                    height={((end - start) / 60) * pxPerHour}
                    onAdd={(startTime, durationHours) =>
                      onAddCard(day.key, startTime, durationHours)
                    }
                  />
                )
              })}

          <ol
            data-testid="card-list"
            className="pointer-events-none relative z-10 flex flex-col px-1.5"
          >
            {placements.map((placement, index) => {
              const previous = placements[index - 1]
              const previousEnd = previous
                ? previous.offsetMinutes + previous.durationMinutes
                : 0
              const gap = ((placement.offsetMinutes - previousEnd) / 60) * pxPerHour
              const c = placement.card
              // A lead-in can reach back past the window's start. The day body is
              // exactly the window tall and the header sits directly above it, so
              // an overflowing band would print over the date rather than scroll:
              // clamp what is drawn to the space above the card, and let the
              // label keep saying the true length.
              const bandPx =
                (Math.min(placement.leadMinutes, placement.offsetMinutes) / 60) * pxPerHour
              return (
                <SortableCard
                  key={c.id}
                  card={c}
                  conflict={conflicts.has(c.id)}
                  onEdit={onEditCard}
                  dayStart={dayStart}
                  dayEnd={dayEnd}
                  showTravelTimes={showTravelTimes}
                  travelBandPx={bandPx}
                  travelBandLabel={travelBandLabel(placement.leadMinutes)}
                  layoutStyle={{
                    height: cardHeightPx(c, dayStart, dayEnd, pxPerHour),
                    marginTop: gap,
                  }}
                />
              )
            })}
          </ol>

          {/* The now-line is drawn above the rails but under the cards, per the
              reference; the gutter carries its time pill. */}
          {nowOffsetPx !== undefined && (
            <span
              aria-hidden
              data-testid="now-line"
              style={{ top: nowOffsetPx }}
              className="pointer-events-none absolute inset-x-0 z-[5] h-px bg-city-vermilion"
            />
          )}

          {dragPreview?.dayKey === day.key && (
            <div
              data-testid="drag-preview-card"
              style={{
                top: previewTopPx,
                height: dragPreview.durationHours * pxPerHour,
              }}
              className="pointer-events-none absolute inset-x-1.5 z-20"
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
    </section>
  )
}
