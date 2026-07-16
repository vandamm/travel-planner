import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Month } from './YearCalendarHome'

it('marks weekends and Bavarian public holidays with the same red treatment', () => {
  const { container, getByTitle } = render(
    <Month
      year={2026}
      month={0}
      trips={[]}
      holidays={[]}
      publicHolidays={[
        { startDate: '2026-01-06', endDate: '2026-01-06', name: 'Epiphany' },
      ]}
    />,
  )

  const saturday = container.querySelector('time[datetime="2026-01-03"]')
  const publicHoliday = getByTitle('Epiphany · Bavaria public holiday')

  expect(saturday).toHaveClass('text-city-vermilion')
  expect(saturday).not.toHaveClass('bg-[#fff0ee]')
  expect(publicHoliday).toHaveClass('bg-[#fff0ee]', 'text-city-vermilion')
})

it('offers trip creation only for empty in-month dates', async () => {
  const onAddTrip = vi.fn()
  const user = userEvent.setup()
  render(
    <Month
      year={2026}
      month={0}
      trips={[]}
      holidays={[]}
      publicHolidays={[]}
      onAddTrip={onAddTrip}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Plan trip starting 3 January 2026' }))
  expect(onAddTrip).toHaveBeenCalledWith('2026-01-03')
})

it('does not offer trip creation on a trip date', () => {
  render(
    <Month
      year={2026}
      month={0}
      trips={[{ id: 'rome', title: 'Rome', startDate: '2026-01-03', endDate: '2026-01-03' }]}
      holidays={[]}
      publicHolidays={[]}
      onAddTrip={vi.fn()}
    />,
  )

  expect(screen.queryByRole('button', { name: 'Plan trip starting 3 January 2026' })).not.toBeInTheDocument()
})
