import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { generateDays } from '../../data/days'
import type { Accommodation, City } from '../../data/schema'
import { AccommodationLane } from './AccommodationLane'

const days = generateDays('2027-05-01', 5)
const cityById = new Map<string, City>([['rome', { id: 'rome', name: 'Rome', color: '#ef4444' }]])

const stay = (over: Partial<Accommodation> = {}): Accommodation => ({
  id: 'a',
  label: 'Hotel Roma',
  cityId: 'rome',
  startNight: '2027-05-02',
  endNight: '2027-05-03',
  ...over,
})

describe('AccommodationLane', () => {
  it('renders a bar spanning the covered columns, colored by its city', () => {
    render(<AccommodationLane days={days} accommodations={[stay()]} cityById={cityById} />)

    const cell = screen.getByTestId('accommodation-cell')
    // 05-02 is column index 1 → 1-based start 2, covering 05-02..05-03 → span 2.
    expect(cell).toHaveStyle({ gridColumn: '2 / span 2' })

    const bar = screen.getByTestId('accommodation-bar')
    expect(bar).toHaveTextContent('Hotel Roma')
    expect(bar).toHaveStyle({ backgroundColor: '#ef4444' })
  })

  it('skips stays that fall outside the visible days', () => {
    render(
      <AccommodationLane
        days={days}
        accommodations={[stay({ startNight: '2030-01-01', endNight: '2030-01-02' })]}
        cityById={cityById}
      />,
    )
    expect(screen.queryByTestId('accommodation-bar')).not.toBeInTheDocument()
  })

  it('calls onEditAccommodation when a bar is clicked', () => {
    const onEdit = vi.fn()
    render(
      <AccommodationLane
        days={days}
        accommodations={[stay()]}
        cityById={cityById}
        onEditAccommodation={onEdit}
      />,
    )
    screen.getByTestId('accommodation-bar').click()
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })

  it('splits two stays covering the same columns onto one row, earlier left / later right', () => {
    render(
      <AccommodationLane
        days={days}
        accommodations={[
          stay({ id: 'a', label: 'A', startNight: '2027-05-02', endNight: '2027-05-03' }),
          stay({ id: 'b', label: 'B', startNight: '2027-05-02', endNight: '2027-05-03' }),
        ]}
        cityById={cityById}
      />,
    )

    const cellA = document.querySelector('[data-testid="accommodation-cell"][data-acc="a"]')!
    const cellB = document.querySelector('[data-testid="accommodation-cell"][data-acc="b"]')!
    expect(cellA).toHaveAttribute('data-half', 'left')
    expect(cellB).toHaveAttribute('data-half', 'right')
    // Both share row 1 (one row, split) instead of stacking on rows 1 and 2.
    expect(cellA).toHaveStyle({ gridRow: '1' })
    expect(cellB).toHaveStyle({ gridRow: '1' })
  })

  it('insets a changeover pair onto one row, outgoing endHalf / incoming startHalf', () => {
    render(
      <AccommodationLane
        days={days}
        accommodations={[
          stay({ id: 'a', label: 'A', startNight: '2027-05-01', endNight: '2027-05-03' }),
          stay({ id: 'b', label: 'B', startNight: '2027-05-03', endNight: '2027-05-05' }),
        ]}
        cityById={cityById}
      />,
    )

    const cellA = document.querySelector('[data-testid="accommodation-cell"][data-acc="a"]')!
    const cellB = document.querySelector('[data-testid="accommodation-cell"][data-acc="b"]')!
    expect(cellA).toHaveAttribute('data-end-half', 'true')
    expect(cellA).not.toHaveAttribute('data-start-half')
    expect(cellB).toHaveAttribute('data-start-half', 'true')
    expect(cellB).not.toHaveAttribute('data-end-half')
    // One shared row.
    expect(cellA).toHaveStyle({ gridRow: '1' })
    expect(cellB).toHaveStyle({ gridRow: '1' })
    // The half-day inset is applied so the bars meet at the middle of the shared day.
    expect(cellA.querySelector('div')).toHaveStyle({ marginRight: 'calc((14rem + 0.75rem) / 2)' })
    expect(cellB.querySelector('div')).toHaveStyle({ marginLeft: 'calc((14rem + 0.75rem) / 2)' })
  })

  it('renders nothing when there are no days', () => {
    const { container } = render(
      <AccommodationLane days={[]} accommodations={[stay()]} cityById={cityById} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
