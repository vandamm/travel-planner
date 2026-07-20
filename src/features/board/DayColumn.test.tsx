import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Card, City, Day } from '../../data/schema'
import { DayColumn } from './DayColumn'
import { DragOverDayContext } from './dragOverDayContext'

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

function scaleLabels() {
  return screen.getAllByTestId('scale-label').map((n) => n.textContent)
}

function hasSlateClass(el: Element) {
  return [...el.classList].some((c) =>
    ['text-slate-', 'bg-slate-', 'border-slate-', 'ring-slate-'].some((prefix) =>
      c.startsWith(prefix),
    ),
  )
}

describe('DayColumn', () => {
  it('renders a color-coded, city-labeled header', () => {
    render(<DayColumn day={day} city={rome} cards={[]} direction="down" />)
    expect(screen.getByTestId('city-name')).toHaveTextContent('Rome')
    expect(screen.getByTestId('city-band')).toHaveStyle({ backgroundColor: '#ef4444' })
  })

  it('shows a neutral header when no city is resolved', () => {
    render(<DayColumn day={day} cards={[]} direction="down" />)
    expect(screen.getByTestId('city-name')).toHaveTextContent('No city')
  })

  it('labels the day with a day-first dd.MM date', () => {
    render(<DayColumn day={day} city={rome} cards={[]} direction="down" />)
    // 2027-05-01 → "Sat · 01.05" (day-first, not "1 May")
    expect(screen.getByTestId('day-label')).toHaveTextContent('01.05')
    expect(screen.getByTestId('day-label')).not.toHaveTextContent('May')
  })

  it('lays out cards morning→evening with the down direction', () => {
    render(<DayColumn day={day} city={rome} cards={cards} direction="down" />)
    expect(titles()).toEqual(['Stroll', 'Breakfast', 'Dinner'])
    expect(scaleLabels()).toEqual(['Morning', 'Evening'])
  })

  it('reverses both the cards and the time scale with the up direction', () => {
    render(<DayColumn day={day} city={rome} cards={cards} direction="up" />)
    expect(titles()).toEqual(['Dinner', 'Breakfast', 'Stroll'])
    expect(scaleLabels()).toEqual(['Evening', 'Morning'])
  })

  it('shows the time on time-bound cards', () => {
    render(<DayColumn day={day} city={rome} cards={cards} direction="down" />)
    const dinner = screen.getByText('Dinner').closest('[data-testid="card"]') as HTMLElement
    expect(within(dinner).getByTestId('card-time')).toHaveTextContent('19:00 · 2h 00m')
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
    render(<DayColumn day={day} cards={overlapping} direction="down" />)
    const card = (title: string) =>
      screen.getByText(title).closest('[data-testid="card"]') as HTMLElement
    expect(within(card('Tour')).getByText('Overlap')).toBeInTheDocument()
    expect(within(card('Museum')).getByText('Overlap')).toBeInTheDocument()
    expect(within(card('Lunch')).queryByText('Overlap')).not.toBeInTheDocument()
    expect(screen.getByText('Tour').closest('li')).toHaveStyle({ marginTop: '180px' })
    expect(screen.getByText('Museum').closest('li')).toHaveStyle({ marginTop: '0px' })
  })

  it('sizes the body to the day window even when empty', () => {
    // 06:00–21:00 = 15h × 60px/h = 900px, so columns stay aligned regardless of
    // how many cards each holds.
    render(<DayColumn day={day} cards={[]} direction="down" dayStart="06:00" dayEnd="21:00" />)
    expect(screen.getByTestId('day-body')).toHaveStyle({ height: '900px' })
  })

  it('anchors the time scale above and below the full-width card list', () => {
    render(<DayColumn day={day} cards={cards} direction="down" />)
    expect(screen.getByTestId('scale')).toHaveClass('inset-x-0', 'justify-between')
    expect(screen.getAllByTestId('scale-label')[0]).toHaveClass('text-center', 'text-[10px]')
    for (const label of screen.getAllByTestId('scale-label')) {
      expect(label).toHaveClass('text-ink-300')
      expect(label).not.toHaveClass('rotate-180')
      expect(hasSlateClass(label)).toBe(false)
    }
    expect(screen.getByTestId('card-list')).toHaveClass('pl-0')
    expect(screen.getByTestId('card-list')).not.toHaveClass('gap-2')
    const addCard = screen.getByRole('button', { name: /Add card/ })
    expect(addCard).toHaveClass('border-edge-300', 'text-ink-500')
    expect(addCard.className).not.toMatch(/slate-/)
  })

  it('scales each card by its duration', () => {
    render(<DayColumn day={day} cards={cards} direction="down" />)
    const li = (title: string) => screen.getByText(title).closest('li') as HTMLElement
    expect(li('Dinner')).toHaveStyle({ height: '120px' })
    expect(li('Breakfast')).toHaveStyle({ height: '60px' })
    expect(li('Stroll')).toHaveStyle({ height: '60px' })
    expect(screen.getByText('Dinner').closest('[data-testid="card"]')).toHaveClass('h-full', 'overflow-hidden')
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
        direction="down"
        dayStart="07:00"
        dayEnd="21:00"
      />,
    )
    expect(screen.getByText('Late start').closest('li')).toHaveStyle({ marginTop: '180px' })
  })

  it('offers Auto, No city, and per-city overrides, defaulting to Auto', () => {
    render(
      <DayColumn day={day} city={rome} cards={[]} direction="down" cities={[rome, florence]} />,
    )
    const select = screen.getByTestId('city-override') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Auto',
      'No city',
      'Rome',
      'Florence',
    ])
    expect(select.value).toBe('') // no override → Auto
    expect(select).not.toHaveAttribute('style')
    expect(select.options[2]).toHaveStyle({ color: '#ef4444' })
    expect(select.options[3]).toHaveStyle({ color: '#3b82f6' })
  })

  it('reflects an existing manual override without an extra marker', () => {
    render(
      <DayColumn
        day={day}
        city={florence}
        cards={[]}
        direction="down"
        cities={[rome, florence]}
        overrideCityId="florence"
      />,
    )
    const select = screen.getByTestId('city-override') as HTMLSelectElement
    expect(select.value).toBe('florence')
    expect(select).toHaveStyle({ borderColor: '#3b82f6', color: '#3b82f6' })
    expect(screen.queryByTestId('override-indicator')).not.toBeInTheDocument()
  })

  it('calls onSetCity with a city id, null for No city, and undefined for Auto', () => {
    const onSetCity = vi.fn()
    render(
      <DayColumn
        day={day}
        city={rome}
        cards={[]}
        direction="down"
        cities={[rome, florence]}
        onSetCity={onSetCity}
      />,
    )
    const select = screen.getByTestId('city-override')
    fireEvent.change(select, { target: { value: 'florence' } })
    expect(onSetCity).toHaveBeenCalledWith('2027-05-01', 'florence')
    fireEvent.change(select, { target: { value: '__no-city__' } })
    expect(onSetCity).toHaveBeenCalledWith('2027-05-01', null)
    fireEvent.change(select, { target: { value: '' } })
    expect(onSetCity).toHaveBeenCalledWith('2027-05-01', undefined)
  })

  it('reflects an explicit no-city override', () => {
    render(
      <DayColumn
        day={day}
        cards={[]}
        direction="down"
        cities={[rome]}
        overrideCityId={null}
      />,
    )
    expect(screen.getByTestId('city-override')).toHaveValue('__no-city__')
  })

  it('opens the day swap workflow from the header action', () => {
    const onSwapDay = vi.fn()
    render(
      <DayColumn
        day={day}
        city={rome}
        cards={[]}
        direction="down"
        onSwapDay={onSwapDay}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Swap day' }))
    expect(onSwapDay).toHaveBeenCalledOnce()
    expect(onSwapDay).toHaveBeenCalledWith(day.key)
  })

  it('omits the override control when there are no cities to choose from', () => {
    render(<DayColumn day={day} cards={[]} direction="down" cities={[]} />)
    expect(screen.queryByTestId('city-override')).not.toBeInTheDocument()
  })

  it('flags weekends with a bold-vermilion weekday label, weekdays muted, no tint', () => {
    const { rerender } = render(<DayColumn day={day} cards={[]} direction="down" />)
    // 2027-05-01 is a Saturday.
    expect(screen.getByTestId('day-column')).not.toHaveClass('bg-rose-50')
    expect(screen.getByTestId('day-label')).toHaveClass('text-city-vermilion')

    const monday: Day = { key: '2027-05-03', index: 2 }
    rerender(<DayColumn day={monday} cards={[]} direction="down" />)
    expect(screen.getByTestId('day-column')).not.toHaveClass('bg-rose-50')
    expect(screen.getByTestId('day-label')).toHaveClass('text-ink-400')
    expect(screen.getByTestId('day-label')).not.toHaveClass('text-city-vermilion')
  })

  it('renders the city colour as a 3px header underline (not a top band)', () => {
    render(<DayColumn day={day} city={rome} cards={[]} direction="down" />)
    const band = screen.getByTestId('city-band')
    expect(band).toHaveStyle({ backgroundColor: '#ef4444' })
    expect(band).toHaveClass('h-[3px]')
  })

  it('renders a labelled NOON divider in the body', () => {
    render(<DayColumn day={day} city={rome} cards={cards} direction="down" />)
    const noon = within(screen.getByTestId('day-body')).getByTestId('noon-divider')
    expect(noon).toHaveTextContent('NOON')
  })

  it('highlights the column when the drag context marks this day as the drop target', () => {
    render(
      <DragOverDayContext.Provider value={day.key}>
        <DayColumn day={day} city={rome} cards={[]} direction="down" />
      </DragOverDayContext.Provider>,
    )
    const column = screen.getByTestId('day-column')
    expect(column).toHaveAttribute('data-drag-over', '')
    expect(column).toHaveClass('border-sky-400', 'ring-2', 'ring-sky-300')
  })

  it('anchors the NOON divider at noon’s fraction — top when down, bottom when up', () => {
    // 06:00–21:00 → noon at 6/15 of the 900px window = 360px.
    // Asserting the value (not just non-empty) catches an inverted fraction or wrong window.
    const { rerender } = render(
      <DayColumn day={day} cards={[]} direction="down" dayStart="06:00" dayEnd="21:00" />,
    )
    const down = screen.getByTestId('noon-divider')
    expect(down.style.top).toBe('360px')
    expect(down.style.bottom).toBe('')

    rerender(<DayColumn day={day} cards={[]} direction="up" dayStart="06:00" dayEnd="21:00" />)
    const up = screen.getByTestId('noon-divider')
    expect(up.style.bottom).toBe('360px')
    expect(up.style.top).toBe('')
  })
})
