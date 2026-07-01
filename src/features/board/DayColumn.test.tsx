import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Card, City, Day } from '../../data/schema'
import { DayColumn } from './DayColumn'

const day: Day = { key: '2027-05-01', index: 0 }
const rome: City = { id: 'rome', name: 'Rome', color: '#ef4444' }
const florence: City = { id: 'florence', name: 'Florence', color: '#3b82f6' }

const cards: Card[] = [
  { id: 'a', dayKey: '2027-05-01', title: 'Stroll', order: 0 },
  { id: 'b', dayKey: '2027-05-01', title: 'Breakfast', order: 5, startTime: '08:00' },
  { id: 'c', dayKey: '2027-05-01', title: 'Dinner', order: 1, startTime: '19:00', endTime: '21:00' },
]

function titles() {
  return screen.getAllByTestId('card-title').map((n) => n.textContent)
}

function scaleLabels() {
  return screen.getAllByTestId('scale-label').map((n) => n.textContent)
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
    expect(titles()).toEqual(['Breakfast', 'Dinner', 'Stroll'])
    expect(scaleLabels()).toEqual(['Morning', 'Afternoon', 'Evening'])
  })

  it('reverses both the cards and the time scale with the up direction', () => {
    render(<DayColumn day={day} city={rome} cards={cards} direction="up" />)
    expect(titles()).toEqual(['Stroll', 'Dinner', 'Breakfast'])
    expect(scaleLabels()).toEqual(['Evening', 'Afternoon', 'Morning'])
  })

  it('shows the time on time-bound cards', () => {
    render(<DayColumn day={day} city={rome} cards={cards} direction="down" />)
    const dinner = screen.getByText('Dinner').closest('[data-testid="card"]') as HTMLElement
    expect(within(dinner).getByTestId('card-time')).toHaveTextContent('19:00–21:00')
  })

  it('sizes the body to the day window even when empty', () => {
    // 06:00–21:00 = 15h × 44px/h = 660px, so columns stay aligned regardless of
    // how many cards each holds.
    render(<DayColumn day={day} cards={[]} direction="down" dayStart="06:00" dayEnd="21:00" />)
    expect(screen.getByTestId('day-body')).toHaveStyle({ minHeight: '660px' })
  })

  it('keeps the scale in a left gutter the cards clear, so labels are never covered', () => {
    render(<DayColumn day={day} cards={cards} direction="down" />)
    expect(screen.getByTestId('scale')).toHaveClass('left-0', 'w-16')
    expect(screen.getByTestId('card-list')).toHaveClass('pl-16')
  })

  it('scales each card by its duration; untimed and end-less cards get one block', () => {
    render(<DayColumn day={day} cards={cards} direction="down" />)
    const li = (title: string) =>
      screen.getByText(title).closest('li') as HTMLElement
    expect(li('Dinner')).toHaveStyle({ minHeight: '88px' }) // 19:00–21:00 = 2h
    expect(li('Breakfast')).toHaveStyle({ minHeight: '44px' }) // timed, no end = 1h
    expect(li('Stroll')).toHaveStyle({ minHeight: '44px' }) // untimed = 1 block
  })

  it('offers an Auto + per-city override control, defaulting to Auto', () => {
    render(
      <DayColumn day={day} city={rome} cards={[]} direction="down" cities={[rome, florence]} />,
    )
    const select = screen.getByTestId('city-override') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['Auto', 'Rome', 'Florence'])
    expect(select.value).toBe('') // no override → Auto
  })

  it('reflects an existing manual override and flags it as manual', () => {
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
    expect((screen.getByTestId('city-override') as HTMLSelectElement).value).toBe('florence')
    expect(screen.getByTestId('override-indicator')).toBeInTheDocument()
  })

  it('shows no manual indicator for an accommodation-resolved city', () => {
    render(<DayColumn day={day} city={rome} cards={[]} direction="down" cities={[rome, florence]} />)
    expect(screen.queryByTestId('override-indicator')).not.toBeInTheDocument()
  })

  it('calls onSetCity with a city id when one is chosen, and null for Auto', () => {
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
    fireEvent.change(select, { target: { value: '' } })
    expect(onSetCity).toHaveBeenCalledWith('2027-05-01', null)
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

  it('anchors the NOON divider at noon’s fraction — top when down, bottom when up', () => {
    // 06:00–21:00 → noon at 6/15 of the 660px window = 264px, plus the py-2 (0.5rem) offset.
    // Asserting the value (not just non-empty) catches an inverted fraction or wrong window.
    const { rerender } = render(
      <DayColumn day={day} cards={[]} direction="down" dayStart="06:00" dayEnd="21:00" />,
    )
    const down = screen.getByTestId('noon-divider')
    expect(down.style.top).toBe('calc(264px + 0.5rem)')
    expect(down.style.bottom).toBe('')

    rerender(<DayColumn day={day} cards={[]} direction="up" dayStart="06:00" dayEnd="21:00" />)
    const up = screen.getByTestId('noon-divider')
    expect(up.style.bottom).toBe('calc(264px + 0.5rem)')
    expect(up.style.top).toBe('')
  })
})
