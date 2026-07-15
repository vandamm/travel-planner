import { render } from '@testing-library/react'
import { addDays, format } from 'date-fns'
import { expect, it } from 'vitest'
import { TimelineHome } from './TimelineHome'

it('keeps a one-day trip marker on the date scale', () => {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { container } = render(
    <TimelineHome
      trips={[{ id: 'day-trip', title: 'Day trip', startDate: today, endDate: today }]}
      holidays={[]}
      onAddTrip={() => {}}
    />,
  )

  const marker = container.querySelector('[data-timeline-trip] > span')
  expect(marker).toHaveClass('ring-4')
  expect(marker).not.toHaveClass('border-4')
})

it('reserves the Today label lane for an active holiday', () => {
  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const { getByText } = render(
    <TimelineHome
      trips={[]}
      holidays={[{ name: 'School holidays', startDate: today, endDate: tomorrow }]}
      onAddTrip={() => {}}
    />,
  )

  expect(getByText(`${format(new Date(), 'd MMM.')} – ${format(addDays(new Date(), 1), 'd MMM.')}`)).toHaveClass('pt-7')
})
