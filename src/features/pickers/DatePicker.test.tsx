import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DatePicker } from './DatePicker'
import type { DateRange } from './calendar'

// jsdom reports window.innerWidth = 1024, so the Popover renders its desktop
// anchored panel; the mobile sheet fallback is covered by the e2e specs. Each
// harness seeds a known month so the calendar opens deterministically (an unset
// picker would seed off the real "today").

function SingleHarness({ initial }: { initial?: string }) {
  const [value, setValue] = useState<string | undefined>(initial)
  return <DatePicker label="Trip start" value={value} onSelect={setValue} />
}

function RangeHarness({ initial }: { initial?: DateRange }) {
  const [range, setRange] = useState<DateRange>(initial ?? {})
  return <DatePicker label="Nights" range={range} onRangeChange={setRange} />
}

describe('DatePicker', () => {
  it('shows the placeholder until a date is picked', () => {
    render(<SingleHarness />)
    expect(screen.getByRole('button', { name: 'Trip start' })).toHaveTextContent('Pick a date')
  })

  it('single-date mode: picks a day, commits the long European date, and closes', async () => {
    const user = userEvent.setup()
    render(<SingleHarness initial="2027-05-10" />)

    await user.click(screen.getByRole('button', { name: 'Trip start' }))
    await user.click(screen.getByRole('button', { name: '15 May 2027' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trip start' })).toHaveTextContent('15.05.2027')
  })

  it('range mode: commits first→last on the second click and closes', async () => {
    const user = userEvent.setup()
    render(<RangeHarness initial={{ start: '2027-05-10' }} />)

    await user.click(screen.getByRole('button', { name: 'Nights' }))
    await user.click(screen.getByRole('button', { name: '12 May 2027' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nights' })).toHaveTextContent('10.05 → 12.05')
  })

  it('range mode: re-picking a complete range restarts the selection and keeps the popover open', async () => {
    const user = userEvent.setup()
    render(<RangeHarness initial={{ start: '2027-05-10', end: '2027-05-14' }} />)

    await user.click(screen.getByRole('button', { name: 'Nights' }))
    // A single click on a new day starts a fresh range (no end yet) → stays open.
    await user.click(screen.getByRole('button', { name: '20 May 2027' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nights' })).toHaveTextContent('20.05 → …')

    // The second click completes the new range and closes.
    await user.click(screen.getByRole('button', { name: '22 May 2027' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nights' })).toHaveTextContent('20.05 → 22.05')
  })

  it('navigates months without committing a value', async () => {
    const user = userEvent.setup()
    const { container } = render(<SingleHarness initial="2027-05-10" />)

    await user.click(screen.getByRole('button', { name: 'Trip start' }))
    expect(container.querySelector('[data-month]')).toHaveAttribute('data-month', '2027-05')

    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(container.querySelector('[data-month]')).toHaveAttribute('data-month', '2027-06')

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(container.querySelector('[data-month]')).toHaveAttribute('data-month', '2027-04')

    // Still open, nothing committed.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trip start' })).toHaveTextContent('10.05.2027')
  })
})
