import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TimelineHome } from './TimelineHome'

afterEach(() => vi.useRealTimers())

it('renders calendar context on the left and trip detail on the right', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T12:00:00'))
  const { container, getByText, queryByText } = render(
    <TimelineHome
      trips={[
        { id: 'day-trip', title: 'Day trip', startDate: '2026-07-20', endDate: '2026-07-20' },
        { id: 'weekend', title: 'Long weekend', startDate: '2026-08-07', endDate: '2026-08-09' },
        { id: 'january-trip', title: 'January trip', startDate: '2027-01-15', endDate: '2027-01-15' },
      ]}
      holidays={[{ name: 'Autumn holidays', startDate: '2026-11-02', endDate: '2026-11-06' }]}
      onAddTrip={() => {}}
    />,
  )

  expect(container.querySelector('[data-timeline-holiday]')).toBeInTheDocument()
  expect(container.querySelector('[data-timeline-trip] [data-trip-start-tick]')).toBeInTheDocument()
  expect(container.querySelector('[data-timeline-trip] [data-trip-end-tick]')).toBeInTheDocument()
  expect(getByText('3 days')).toBeInTheDocument()
  expect(queryByText('1 days')).not.toBeInTheDocument()
  expect(getByText('2027')).toBeInTheDocument()
})
