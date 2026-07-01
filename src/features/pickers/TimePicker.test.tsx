import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TimePicker } from './TimePicker'

// jsdom reports window.innerWidth = 1024, so the Popover renders its desktop
// anchored panel; the mobile sheet fallback is covered by the e2e specs.

/** Controlled harness so the trigger reflects the committed value. */
function Harness({ onClear }: { onClear?: () => void }) {
  const [value, setValue] = useState<string | undefined>(undefined)
  return <TimePicker label="Start time" value={value} onChange={setValue} onClear={onClear} />
}

describe('TimePicker', () => {
  it('shows the placeholder until a time is set', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Start time' })).toHaveTextContent('Set time')
  })

  it('picks an hour + minute and commits HH:mm, then closes', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Start time' }))
    await user.click(screen.getByRole('option', { name: 'Hour 08' }))
    await user.click(screen.getByRole('option', { name: 'Minute 45' }))
    await user.click(screen.getByRole('button', { name: 'Set 08:45' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start time' })).toHaveTextContent('08:45')
  })

  it('seeds the wheel from an existing value', async () => {
    const user = userEvent.setup()
    render(<TimePicker label="Start time" value="14:15" onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Start time' }))
    expect(screen.getByRole('option', { name: 'Hour 14' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Minute 15' })).toHaveAttribute('aria-selected', 'true')
  })

  it('offers Clear only when onClear is given, and calls it', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<Harness onClear={onClear} />)

    await user.click(screen.getByRole('button', { name: 'Start time' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hides Clear when no onClear is given', async () => {
    const user = userEvent.setup()
    render(<TimePicker label="Day start" value="06:00" onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Day start' }))
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })
})
