import { fireEvent, render } from '@testing-library/react'
import { addDays, addMonths, differenceInDays, parseISO } from 'date-fns'
import { afterEach, expect, it, vi } from 'vitest'
import { TimelineHome } from './TimelineHome'
import { timelineHeight } from './yearCalendar'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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
  const startTick = container.querySelector('[data-timeline-trip] [data-trip-start-tick]')
  const endTick = container.querySelector('[data-timeline-trip] [data-trip-end-tick]')
  expect(startTick).toHaveClass('w-[16px]')
  expect(endTick).toHaveClass('w-[16px]')
  expect(getByText('3 days')).toBeInTheDocument()
  expect(queryByText('1 days')).not.toBeInTheDocument()
  const year = getByText('2027')
  expect(year).toBeInTheDocument()

  const tripMarker = container.querySelector('[data-timeline-trip] > span')
  expect(tripMarker).toHaveClass('left-1/2', 'w-[14px]')
  expect(tripMarker).not.toHaveClass('-translate-x-1/2')

  const holiday = container.querySelector('[data-timeline-holiday]')
  expect(holiday).toHaveClass(
    'right-1/2',
    'w-[44px]',
    'sm:w-[62px]',
    'bg-[rgba(210,220,187,.4)]',
  )
  expect(holiday).not.toHaveClass('border-y')
  expect(holiday?.querySelector('time')).toHaveClass(
    'right-[calc(100%+8px)]',
    'whitespace-nowrap',
    'text-[11px]',
    'sm:text-[13px]',
    'opacity-0',
    'group-hover:opacity-100',
  )

  const august = getByText('August')
  expect(august).toHaveClass('text-[12.5px]', 'font-semibold', 'tracking-[.08em]')
  expect(august.parentElement).toHaveClass(
    'right-[calc(50%+52px)]',
    'sm:right-[calc(50%+70px)]',
    'w-[84px]',
    'sm:w-[112px]',
  )
  expect(august).toHaveClass('translate-y-1')
  expect(august).not.toHaveClass('-translate-y-full')
  expect(august.querySelector('span')).toHaveClass(
    'top-[-4px]',
    'w-[calc(100%+52px)]',
    'sm:w-[calc(100%+70px)]',
  )
  expect(year).toHaveClass('translate-y-1')
  expect(year.parentElement).toHaveClass('w-[84px]', 'sm:w-[112px]')
  expect(year.querySelector('span')).toHaveClass(
    'left-0',
    'top-[-4px]',
    'w-[calc(100%+52px)]',
    'sm:w-[calc(100%+70px)]',
  )
  expect(getByText('15 July 2026')).toHaveClass('text-[11px]')
})

it('shows at least six months when there are no trips', () => {
  vi.useFakeTimers()
  const today = new Date('2026-07-15T12:00:00')
  vi.setSystemTime(today)
  const { container } = render(<TimelineHome trips={[]} holidays={[]} onAddTrip={() => {}} />)
  const sixMonths = differenceInDays(addMonths(today, 6), today) + 1

  expect(container.querySelector('[data-timeline-canvas]')).toHaveStyle({
    height: `${timelineHeight(sixMonths)}px`,
  })
})

it('extends one month beyond the latest trip', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T12:00:00'))
  const endDate = '2027-03-22'
  const { container } = render(
    <TimelineHome
      trips={[{ id: 'japan-2027', title: 'Japan', startDate: endDate, endDate }]}
      holidays={[]}
      onAddTrip={() => {}}
    />,
  )
  const expectedDays = differenceInDays(
    addDays(addMonths(parseISO(endDate), 1), 1),
    parseISO('2026-07-15'),
  )

  expect(container.querySelector('[data-timeline-canvas]')).toHaveStyle({
    height: `${timelineHeight(expectedDays)}px`,
  })
})

it('moves a holiday date with the pointer without leaving its band', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T12:00:00'))
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const { container } = render(
    <TimelineHome
      trips={[]}
      holidays={[{ name: 'Summer holidays', startDate: '2026-08-03', endDate: '2026-09-14' }]}
      onAddTrip={() => {}}
    />,
  )
  const holiday = container.querySelector('[data-timeline-holiday]') as HTMLElement
  const label = holiday.querySelector('time')
  vi.spyOn(holiday, 'getBoundingClientRect').mockReturnValue({
    top: 200,
    bottom: 300,
    height: 100,
    left: 0,
    right: 44,
    width: 44,
    x: 0,
    y: 200,
    toJSON: () => ({}),
  })

  fireEvent.mouseMove(holiday, { clientY: 205 })
  expect(label).toHaveStyle({ top: '10px' })
  fireEvent.mouseMove(holiday, { clientY: 295 })
  expect(label).toHaveStyle({ top: '90px' })
  fireEvent.mouseLeave(holiday)
  expect(label).toHaveStyle({ top: '90px' })
})
