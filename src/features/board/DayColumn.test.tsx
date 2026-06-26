import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Card, City, Day } from '../../data/schema'
import { DayColumn } from './DayColumn'

const day: Day = { key: '2027-05-01', index: 0 }
const rome: City = { id: 'rome', name: 'Rome', color: '#ef4444' }

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

  it('tints weekend columns and leaves weekdays white', () => {
    const { rerender } = render(<DayColumn day={day} cards={[]} direction="down" />)
    // 2027-05-01 is a Saturday.
    expect(screen.getByTestId('day-column')).toHaveClass('bg-rose-50')

    const monday: Day = { key: '2027-05-03', index: 2 }
    rerender(<DayColumn day={monday} cards={[]} direction="down" />)
    expect(screen.getByTestId('day-column')).toHaveClass('bg-white')
  })
})
