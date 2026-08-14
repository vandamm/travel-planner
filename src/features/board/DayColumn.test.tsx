import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Card, City, Day } from '../../data/schema'
import { DayColumn } from './DayColumn'
import { DragOverDayContext, DragPreviewContext } from './dragOverDayContext'

const day: Day = { key: '2027-05-01', index: 0 }
const rome: City = { id: 'rome', name: 'Rome', color: '#ef4444' }
const florence: City = { id: 'florence', name: 'Florence', color: '#3b82f6' }

const cards: Card[] = [
  {
    id: 'a',
    dayKey: '2027-05-01',
    title: 'Stroll',
    order: 0,
    duration: 'custom',
    durationHours: 1,
  },
  {
    id: 'b',
    dayKey: '2027-05-01',
    title: 'Breakfast',
    order: 5,
    startTime: '08:00',
    duration: 'custom',
    durationHours: 1,
  },
  {
    id: 'c',
    dayKey: '2027-05-01',
    title: 'Dinner',
    order: 1,
    startTime: '19:00',
    duration: 'custom',
    durationHours: 2,
  },
]

function titles() {
  return screen.getAllByTestId('card-title').map((n) => n.textContent)
}

describe('DayColumn', () => {
  it('renders a color-coded, city-labeled header', () => {
    render(<DayColumn day={day} city={rome} cards={[]} />)
    expect(screen.getByTestId('city-name')).toHaveTextContent('Rome')
    expect(screen.getByTestId('city-band')).toHaveStyle({ backgroundColor: '#ef4444' })
  })

  it('fills available board width while keeping the multi-week minimum width', () => {
    render(<DayColumn day={day} city={rome} cards={[]} />)

    const column = screen.getByTestId('day-column')
    expect(column).toHaveStyle({ flex: '1 0 16rem', minWidth: '16rem' })
    expect(column.style.width).toBe('')
  })

  it('shows a neutral header when no city is resolved', () => {
    render(<DayColumn day={day} cards={[]} />)
    expect(screen.getByTestId('city-name')).toHaveTextContent('No city')
  })

  it('labels the day with the approved uppercase weekday and date', () => {
    render(<DayColumn day={day} city={rome} cards={[]} />)
    expect(screen.getByTestId('day-label')).toHaveTextContent('SAT · 01.05')
  })

  it('lays out cards morning→evening', () => {
    render(<DayColumn day={day} city={rome} cards={cards} />)
    expect(titles()).toEqual(['Stroll', 'Breakfast', 'Dinner'])
    expect(screen.queryByText('Morning')).not.toBeInTheDocument()
    expect(screen.queryByText('Evening')).not.toBeInTheDocument()
  })

  it('shows the time on time-bound cards', () => {
    render(<DayColumn day={day} city={rome} cards={cards} />)
    const dinner = screen.getByText('Dinner').closest('[data-testid="card"]') as HTMLElement
    expect(within(dinner).getByTestId('card-time')).toHaveTextContent('19:00 – 21:00 · 2h')
  })

  it('marks every timed card involved in an overlap', () => {
    const overlapping: Card[] = [
      {
        id: 'a',
        dayKey: day.key,
        title: 'Tour',
        order: 0,
        startTime: '09:00',
        duration: 'custom',
        durationHours: 2,
      },
      {
        id: 'b',
        dayKey: day.key,
        title: 'Museum',
        order: 1,
        startTime: '10:30',
        duration: 'custom',
        durationHours: 1.5,
      },
      {
        id: 'c',
        dayKey: day.key,
        title: 'Lunch',
        order: 2,
        startTime: '12:00',
        duration: 'custom',
        durationHours: 1,
      },
    ]
    render(<DayColumn day={day} cards={overlapping} />)
    const card = (title: string) =>
      screen.getByText(title).closest('[data-testid="card"]') as HTMLElement
    expect(within(card('Tour')).getByText('Overlap')).toBeInTheDocument()
    expect(within(card('Museum')).getByText('Overlap')).toBeInTheDocument()
    expect(within(card('Lunch')).queryByText('Overlap')).not.toBeInTheDocument()
    // Tour is at 09:00 (180px). Museum starts at 10:30, half an hour before Tour
    // ends, so it pulls up by 30px to sit on its own hour rather than being
    // shoved below Tour — the overlap is shown, not hidden.
    expect(screen.getByText('Tour').closest('li')).toHaveStyle({ marginTop: '180px' })
    expect(screen.getByText('Museum').closest('li')).toHaveStyle({ marginTop: '-30px' })
  })

  it('is exactly the day window tall, with no dead space above or below', () => {
    // 06:00–21:00 is 15h at 60px/hour. Any extra would show as blank space under
    // the last rail and push the board into a needless vertical scroll.
    render(<DayColumn day={day} cards={[]} dayStart="06:00" dayEnd="21:00" />)
    expect(screen.getByTestId('day-body')).toHaveStyle({ height: '900px' })
    const track = screen.getByTestId('timeline-track')
    expect(track).toHaveStyle({ height: '900px' })
    expect(track).toHaveClass('top-0')

    // A shorter window shrinks to match rather than keeping a fixed frame.
    render(<DayColumn day={day} cards={[]} dayStart="07:00" dayEnd="20:00" />)
    expect(screen.getAllByTestId('day-body').at(-1)).toHaveStyle({ height: '780px' })
  })

  it('carries the scale as two-hourly rails, the labels living in the shared gutter', () => {
    render(<DayColumn day={day} cards={cards} />)
    // The numerals moved to the board's one shared gutter (v4); the column keeps
    // only the rails they line up with.
    expect(screen.queryByTestId('hour-mark')).not.toBeInTheDocument()
    const rails = screen.getAllByTestId('grid-rail')
    expect(rails).toHaveLength(8)
    expect(rails[0]).toHaveStyle({ top: '0px' })
    expect(rails[1]).toHaveStyle({ top: '120px' })
    // The first rail is the stronger hairline, the rest the lighter grid tone.
    expect(rails[0]).toHaveClass('bg-hour-rule')
    expect(rails[1]).toHaveClass('bg-hour-grid')
    expect(screen.queryByTestId('scale')).not.toBeInTheDocument()
    expect(screen.getByTestId('card-list')).toHaveClass('pointer-events-none')
    for (const card of screen.getAllByTestId('sortable-card')) {
      expect(card).toHaveClass('pointer-events-auto')
    }
    expect(screen.getByTestId('card-list')).not.toHaveClass('gap-2')
    expect(screen.getByTestId('timeline-track')).toHaveClass('inset-x-0')
  })

  it('leaves free time empty, offering a hover band only in gaps of 45 min or more', () => {
    const onAddCard = vi.fn()
    render(<DayColumn day={day} cards={cards} onAddCard={onAddCard} />)

    const slots = screen.getAllByTestId('timeline-slot')
    expect(slots).toHaveLength(2)
    expect(slots[0]).toHaveStyle({ top: '60px', height: '60px' })
    expect(slots[1]).toHaveStyle({ top: '180px', height: '600px' })
    for (const slot of slots) {
      // No resting box and no duration label — the gap renders as nothing until
      // the band appears on hover.
      expect(slot.className).not.toMatch(/border|bg-/)
      expect(slot).not.toHaveTextContent(/hours? free/)
      const band = within(slot).getByTestId('plan-band')
      expect(band).toHaveTextContent('＋ plan something')
      expect(band).toHaveClass('hidden', 'border-dashed', 'border-edge-plan')
      expect(band).toHaveClass('group-hover:flex', 'group-focus-visible:flex')
    }
    // The one-hour band clamps to the gap when the gap is shorter than an hour.
    expect(within(slots[0]).getByTestId('plan-band')).toHaveStyle({ height: '60px' })
    expect(within(slots[1]).getByTestId('plan-band')).toHaveStyle({ height: '60px' })

    // Clicking seeds exactly the band that was on screen.
    fireEvent.click(slots[1])
    expect(onAddCard).toHaveBeenCalledWith(day.key, '09:00', 1)
    expect(screen.queryByRole('button', { name: 'Add activity' })).not.toBeInTheDocument()
  })

  it('offers no hover affordance in a gap under 45 minutes', () => {
    render(
      <DayColumn
        day={day}
        onAddCard={vi.fn()}
        cards={[
          {
            id: 'a',
            dayKey: day.key,
            title: 'A',
            order: 0,
            startTime: '06:00',
            duration: 'custom',
            durationHours: 1,
          },
          {
            id: 'b',
            dayKey: day.key,
            title: 'B',
            order: 1,
            startTime: '07:30',
            duration: 'custom',
            durationHours: 13.5,
          },
        ]}
      />,
    )
    // The only gap is 07:00–07:30 — too short to plan into; use the header ＋.
    expect(screen.queryAllByTestId('timeline-slot')).toHaveLength(0)
  })

  it('adds an untimed activity to this day from the header ＋', () => {
    const onAddCard = vi.fn()
    render(<DayColumn day={day} cards={cards} onAddCard={onAddCard} />)
    fireEvent.click(screen.getByRole('button', { name: /Add activity to/ }))
    // No start time: the day is fixed by the column, the time is left empty.
    expect(onAddCard).toHaveBeenCalledWith(day.key)
  })

  it('scales each card by its duration', () => {
    render(<DayColumn day={day} cards={cards} />)
    const li = (title: string) => screen.getByText(title).closest('li') as HTMLElement
    expect(li('Dinner')).toHaveStyle({ height: '120px' })
    expect(li('Breakfast')).toHaveStyle({ height: '60px' })
    expect(li('Stroll')).toHaveStyle({ height: '60px' })
    expect(screen.getByText('Dinner').closest('[data-testid="card"]')).toHaveClass(
      'w-full',
      'h-[calc(100%-2px)]',
      'overflow-hidden',
    )
  })

  it('offsets timed cards from the configured day start', () => {
    render(
      <DayColumn
        day={day}
        cards={[
          {
            id: 'late',
            dayKey: day.key,
            title: 'Late start',
            order: 0,
            startTime: '10:00',
            duration: 'custom',
            durationHours: 1,
          },
        ]}
        dayStart="07:00"
        dayEnd="21:00"
      />,
    )
    expect(screen.getByText('Late start').closest('li')).toHaveStyle({ marginTop: '180px' })
  })

  it('offers Auto, No city, and per-city overrides, defaulting to Auto', () => {
    render(
      <DayColumn day={day} city={rome} cards={[]} cities={[rome, florence]} />,
    )
    const picker = screen.getByRole('button', { name: 'Choose city' })
    expect(picker).toHaveTextContent('✎')
    expect(picker).not.toHaveClass('border', 'rounded-card')
    fireEvent.click(picker)
    expect(screen.getByRole('button', { name: /Auto/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /No city/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rome/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Florence/ })).toBeInTheDocument()
  })

  it('reflects an existing manual override without an extra marker', () => {
    render(
      <DayColumn
        day={day}
        city={florence}
        cards={[]}
        cities={[rome, florence]}
        overrideCityId="florence"
      />,
    )
    expect(screen.getByRole('button', { name: 'Choose city' })).toHaveTextContent('✎')
    expect(screen.queryByTestId('override-indicator')).not.toBeInTheDocument()
  })

  it('calls onSetCity with a city id, null for No city, and undefined for Auto', () => {
    const onSetCity = vi.fn()
    render(
      <DayColumn
        day={day}
        city={rome}
        cards={[]}
        cities={[rome, florence]}
        onSetCity={onSetCity}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Choose city' }))
    fireEvent.click(screen.getByRole('button', { name: /Florence/ }))
    expect(onSetCity).toHaveBeenCalledWith('2027-05-01', 'florence')
    fireEvent.click(screen.getByRole('button', { name: 'Choose city' }))
    fireEvent.click(screen.getByRole('button', { name: /No city/ }))
    expect(onSetCity).toHaveBeenCalledWith('2027-05-01', null)
    fireEvent.click(screen.getByRole('button', { name: 'Choose city' }))
    fireEvent.click(screen.getByRole('button', { name: /Auto/ }))
    expect(onSetCity).toHaveBeenCalledWith('2027-05-01', undefined)
  })

  it('reflects an explicit no-city override', () => {
    render(
      <DayColumn day={day} cards={[]} cities={[rome]} overrideCityId={null} />,
    )
    expect(screen.getByRole('button', { name: 'Choose city' })).toHaveTextContent('✎')
  })

  it('opens the day swap workflow from the header action', () => {
    const onSwapDay = vi.fn()
    render(<DayColumn day={day} city={rome} cards={[]} onSwapDay={onSwapDay} />)
    fireEvent.click(screen.getByRole('button', { name: 'Swap day' }))
    expect(onSwapDay).toHaveBeenCalledOnce()
    expect(onSwapDay).toHaveBeenCalledWith(day.key)
  })

  it('omits the override control when there are no cities to choose from', () => {
    render(<DayColumn day={day} cards={[]} cities={[]} />)
    expect(screen.queryByRole('button', { name: 'Choose city' })).not.toBeInTheDocument()
  })

  it('flags weekends with a bold-vermilion weekday label, weekdays muted, no tint', () => {
    const { rerender } = render(<DayColumn day={day} cards={[]} />)
    // 2027-05-01 is a Saturday.
    expect(screen.getByTestId('day-column')).not.toHaveClass('bg-rose-50')
    expect(screen.getByTestId('day-label')).toHaveClass('text-city-vermilion')

    const monday: Day = { key: '2027-05-03', index: 2 }
    rerender(<DayColumn day={monday} cards={[]} />)
    expect(screen.getByTestId('day-column')).not.toHaveClass('bg-rose-50')
    expect(screen.getByTestId('day-label')).toHaveClass('text-ink-400')
    expect(screen.getByTestId('day-label')).not.toHaveClass('text-city-vermilion')
  })

  it('renders the city colour as a 4px header underline flush to the column edges', () => {
    render(<DayColumn day={day} city={rome} cards={[]} />)
    const band = screen.getByTestId('city-band')
    expect(band).toHaveStyle({ backgroundColor: '#ef4444' })
    expect(band).toHaveClass('h-1', 'w-full')
  })

  it('separates days with one full-height hairline, and no other column chrome', () => {
    const { rerender } = render(<DayColumn day={day} city={rome} cards={cards} />)
    const column = screen.getByTestId('day-column')
    // The divider is on the column itself so it runs unbroken from the header
    // row down through the whole grid.
    expect(column).toHaveClass('border-r', 'border-edge-divider')
    expect(column).not.toHaveClass('border-l')
    expect(column.className).not.toMatch(/rounded|shadow/)
    expect(screen.getByTestId('day-body')).not.toHaveClass('overflow-y-auto')
    expect(screen.queryByTestId('noon-divider')).not.toBeInTheDocument()

    // Only the board's first column closes the run with a left hairline too.
    rerender(<DayColumn day={day} city={rome} cards={cards} firstColumn />)
    expect(screen.getByTestId('day-column')).toHaveClass('border-l')
  })

  it('runs the now-line across every column but pills only today', () => {
    const { rerender } = render(<DayColumn day={day} city={rome} cards={[]} />)
    expect(screen.queryByTestId('today-pill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('now-line')).not.toBeInTheDocument()
    expect(screen.getByTestId('day-column')).not.toHaveAttribute('data-today')

    // A column that is not today still carries the hairline, so the line reads
    // as one rule across the whole board.
    rerender(<DayColumn day={day} city={rome} cards={[]} nowOffsetPx={510} />)
    expect(screen.getByTestId('now-line')).toHaveStyle({ top: '510px' })
    expect(screen.queryByTestId('today-pill')).not.toBeInTheDocument()

    rerender(<DayColumn day={day} city={rome} cards={[]} nowOffsetPx={510} isToday />)
    expect(screen.getByTestId('today-pill')).toHaveTextContent('Today')
    expect(screen.getByTestId('day-column')).toHaveAttribute('data-today', '')
    // No background tint on the column — the pill and hairline carry it.
    expect(screen.getByTestId('day-column').className).not.toMatch(/bg-(?!white)/)
  })

  it('highlights the column when the drag context marks this day as the drop target', () => {
    render(
      <DragOverDayContext.Provider value={day.key}>
        <DayColumn day={day} city={rome} cards={[]} />
      </DragOverDayContext.Provider>,
    )
    const column = screen.getByTestId('day-column')
    expect(column).toHaveAttribute('data-drag-over', '')
    expect(column).toHaveClass('ring-2', 'ring-sky-300')
  })

  it('renders the active drag preview inside its current target day', () => {
    render(
      <DragPreviewContext.Provider
        value={{ card: cards[1], dayKey: day.key, startTime: '10:15', durationHours: 1 }}
      >
        <DayColumn day={day} city={rome} cards={cards} />
      </DragPreviewContext.Provider>,
    )

    const preview = within(screen.getByTestId('timeline-track')).getByTestId('drag-preview-card')
    expect(preview).toHaveTextContent('Breakfast')
    expect(within(preview).getByTestId('event-timing-start')).toHaveTextContent('10:15')
    expect(within(preview).getByTestId('event-timing-end')).toHaveTextContent('11:15')
  })

})
