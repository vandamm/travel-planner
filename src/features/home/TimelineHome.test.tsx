import { render } from '@testing-library/react'
import { addDays, format } from 'date-fns'
import { afterEach, expect, it, vi } from 'vitest'
import { TimelineHome } from './TimelineHome'
import { timelineHeight } from './yearCalendar'

afterEach(() => vi.useRealTimers())

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

  const label = getByText(`${format(new Date(), 'd MMM.')} – ${format(addDays(new Date(), 1), 'd MMM.')}`)
  expect(label).toHaveStyle({ top: '28px' })
  expect(label).not.toHaveClass('pt-7')
})

it('reserves the month marker lane for a holiday starting on the first', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T12:00:00'))
  const { getByText } = render(
    <TimelineHome
      trips={[]}
      holidays={[{ name: 'School holidays', startDate: '2026-08-01', endDate: '2026-08-02' }]}
      onAddTrip={() => {}}
    />,
  )

  expect(getByText('1 Aug. – 2 Aug.')).toHaveStyle({ top: `${timelineHeight(17) + 28}px` })
})
