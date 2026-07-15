import { render } from '@testing-library/react'
import { format } from 'date-fns'
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
