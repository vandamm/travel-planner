import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Card, City, Day } from '../../data/schema'
import { MobileDayView } from './MobileDayView'
import { clampDayIndex } from './mobileDayViewMath'

const days: Day[] = [
  { key: '2027-05-01', index: 0 },
  { key: '2027-05-02', index: 1 },
  { key: '2027-05-03', index: 2 },
]

const cardsByDay = new Map<string, Card[]>([
  ['2027-05-01', [{ id: 'a', dayKey: '2027-05-01', title: 'Arrive', order: 0, duration: 'custom', durationHours: 1 }]],
  ['2027-05-02', [{ id: 'b', dayKey: '2027-05-02', title: 'Museum', order: 0, duration: 'custom', durationHours: 1 }]],
])

function renderView(extra: Partial<Parameters<typeof MobileDayView>[0]> = {}) {
  return render(
    <MobileDayView
      days={days}
      cardsByDay={cardsByDay}
      accommodations={[]}
      overrides={{}}
      cityById={new Map<string, City>()}
      direction="down"
      {...extra}
    />,
  )
}

function currentDay() {
  return screen.getByTestId('day-column').getAttribute('data-day')
}

function visibleDays() {
  return screen.getAllByTestId('day-column').map((el) => el.getAttribute('data-day'))
}

describe('clampDayIndex', () => {
  it('clamps below zero to the first day', () => {
    expect(clampDayIndex(-3, 3)).toBe(0)
  })

  it('clamps past the end to the last day', () => {
    expect(clampDayIndex(9, 3)).toBe(2)
  })

  it('returns an in-range index unchanged', () => {
    expect(clampDayIndex(1, 3)).toBe(1)
  })

  it('returns zero when there are no days', () => {
    expect(clampDayIndex(2, 0)).toBe(0)
  })
})

describe('MobileDayView', () => {
  it('renders only the current day with its cards and position', () => {
    renderView()
    expect(screen.getAllByTestId('day-column')).toHaveLength(1)
    expect(currentDay()).toBe('2027-05-01')
    expect(screen.getByTestId('card-title')).toHaveTextContent('Arrive')
    expect(screen.getByTestId('mobile-day-position')).toHaveTextContent('Day 1 of 3')
  })

  it('keeps bottom safe-area padding in the inner mobile scroller', () => {
    renderView()
    expect(screen.getByTestId('mobile-day-scroll')).toHaveClass(
      'pb-[calc(2rem+env(safe-area-inset-bottom))]',
      'scroll-pb-[calc(2rem+env(safe-area-inset-bottom))]',
    )
  })

  it('pages forward and back, clamping at the first and last day', async () => {
    const user = userEvent.setup()
    renderView()
    const prev = screen.getByRole('button', { name: 'Previous day' })
    const next = screen.getByRole('button', { name: 'Next day' })

    // Clamped at the first day: there is nowhere to go back to.
    expect(prev).toBeDisabled()

    await user.click(next)
    expect(currentDay()).toBe('2027-05-02')
    expect(screen.getByTestId('mobile-day-position')).toHaveTextContent('Day 2 of 3')

    await user.click(next)
    expect(currentDay()).toBe('2027-05-03')
    // Clamped at the last day.
    expect(next).toBeDisabled()

    await user.click(prev)
    expect(currentDay()).toBe('2027-05-02')
  })

  it('advances on a left swipe and goes back on a right swipe', () => {
    renderView()
    const view = screen.getByTestId('mobile-day-view')

    fireEvent.touchStart(view, { touches: [{ clientX: 300 }] })
    fireEvent.touchEnd(view, { changedTouches: [{ clientX: 40 }] })
    expect(currentDay()).toBe('2027-05-02')

    fireEvent.touchStart(view, { touches: [{ clientX: 40 }] })
    fireEvent.touchEnd(view, { changedTouches: [{ clientX: 300 }] })
    expect(currentDay()).toBe('2027-05-01')
  })

  it('ignores a mostly-vertical gesture so scrolling does not page', () => {
    renderView()
    const view = screen.getByTestId('mobile-day-view')

    // Horizontal drift exceeds the threshold, but vertical travel dominates:
    // this is a scroll, not a swipe, so the day must not change.
    fireEvent.touchStart(view, { touches: [{ clientX: 300, clientY: 100 }] })
    fireEvent.touchEnd(view, { changedTouches: [{ clientX: 255, clientY: 400 }] })
    expect(currentDay()).toBe('2027-05-01')
  })

  it('renders a window of days when more than one column fits', () => {
    renderView({ columns: 2 })
    expect(visibleDays()).toEqual(['2027-05-01', '2027-05-02'])
    expect(screen.getByTestId('mobile-day-position')).toHaveTextContent('Days 1–2 of 3')
  })

  it('pages by a whole window and shows the trailing partial page', async () => {
    const user = userEvent.setup()
    renderView({ columns: 2 })
    const next = screen.getByRole('button', { name: 'Next day' })

    await user.click(next)
    // Three days, window of two: the second page is the single trailing day.
    expect(visibleDays()).toEqual(['2027-05-03'])
    expect(screen.getByTestId('mobile-day-position')).toHaveTextContent('Day 3 of 3')
    expect(next).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(visibleDays()).toEqual(['2027-05-01', '2027-05-02'])
  })

  it('renders one pager dot per day and marks the current one', async () => {
    const user = userEvent.setup()
    renderView()
    const dots = screen.getAllByTestId('mobile-day-dot')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveAttribute('aria-current', 'true')
    expect(dots[1]).not.toHaveAttribute('aria-current')

    await user.click(dots[2])
    expect(currentDay()).toBe('2027-05-03')
    expect(screen.getAllByTestId('mobile-day-dot')[2]).toHaveAttribute('aria-current', 'true')
  })

  it('renders one pager dot per page when multiple columns fit', () => {
    renderView({ columns: 2 })
    // Three days, window of two → two pages, two dots.
    expect(screen.getAllByTestId('mobile-day-dot')).toHaveLength(2)
  })

  it('fills the active dot with the day city colour', () => {
    renderView({
      overrides: { '2027-05-01': 'kyoto' },
      cityById: new Map<string, City>([
        ['kyoto', { id: 'kyoto', name: 'Kyoto', color: '#5f6f44' }],
      ]),
    })
    const [active] = screen.getAllByTestId('mobile-day-dot')
    expect(active).toHaveStyle({ backgroundColor: '#5f6f44' })
  })
})
