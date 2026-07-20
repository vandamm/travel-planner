import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventTimingHint } from './EventTimingHint'

describe('EventTimingHint', () => {
  it('shows snapped start, end, and minute-precise duration values', () => {
    render(<EventTimingHint startTime="10:15" durationHours={1.75} />)

    expect(screen.getByTestId('event-timing-start')).toHaveTextContent('10:15')
    expect(screen.getByTestId('event-timing-end')).toHaveTextContent('12:00')
    expect(screen.getByTestId('event-timing-duration')).toHaveTextContent('1h 45m')
  })

  it.each([
    [0.25, '15m'],
    [1, '1h'],
    [1.5, '1h 30m'],
  ])('formats %s hours as %s', (durationHours, label) => {
    render(<EventTimingHint startTime="08:00" durationHours={durationHours} />)
    expect(screen.getByTestId('event-timing-duration')).toHaveTextContent(label)
  })

  it('uses em dashes for an untimed hint', () => {
    render(<EventTimingHint startTime={null} durationHours={1} />)

    expect(screen.getByTestId('event-timing-start')).toHaveTextContent('—')
    expect(screen.getByTestId('event-timing-end')).toHaveTextContent('—')
  })

  it('uses the indoor palette with times outside and a compact centered duration', () => {
    render(<EventTimingHint startTime="10:15" durationHours={1.75} />)

    expect(screen.getByTestId('event-timing-hint')).toHaveClass(
      'border-indoor-border',
      'bg-indoor-bg',
      'font-sans',
      'shadow-none',
    )
    expect(screen.getByTestId('event-timing-start')).toHaveClass('absolute', '-top-5')
    expect(screen.getByTestId('event-timing-end')).toHaveClass('absolute', '-bottom-5')
    expect(screen.getByTestId('event-timing-duration')).toHaveClass(
      'text-[11px]',
      'text-ink-600',
    )
    expect(screen.queryByText(/Moving activity/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-title')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-note')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-category')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resize/i })).not.toBeInTheDocument()
  })
})
