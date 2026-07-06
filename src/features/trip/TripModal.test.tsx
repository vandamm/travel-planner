import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { setTrip } from '../../data/doc'
import { RoomProvider, useRoom } from '../../data/RoomProvider'
import { TripModal } from './TripModal'

function renderInRoom(ui: ReactNode) {
  return render(
    <RoomProvider workerUrl="" token={null} enableSync={false}>
      {ui}
    </RoomProvider>,
  )
}

/** Seeds a known start date once so the calendar opens on a deterministic month. */
function TripWithStart() {
  const { doc } = useRoom()
  useState(() => setTrip(doc, { startDate: '2027-05-10' }))
  return <TripModal onClose={() => {}} />
}

describe('TripModal', () => {
  it('writes title and day count into the trip live', () => {
    renderInRoom(<TripModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Trip title'), { target: { value: 'Italy' } })
    fireEvent.change(screen.getByLabelText('Number of days'), { target: { value: '12' } })

    expect(screen.getByLabelText('Trip title')).toHaveValue('Italy')
    expect(screen.getByLabelText('Number of days')).toHaveValue(12)
  })

  it('picks the start date through the calendar and shows it European', async () => {
    const user = userEvent.setup()
    renderInRoom(<TripWithStart />)

    // The trigger shows the seeded ISO date European (dd.MM.yyyy).
    const trigger = screen.getByRole('button', { name: 'Start date' })
    expect(trigger).toHaveTextContent('10.05.2027')

    // Open the calendar (seeded to May 2027) and pick the 1st → live write + rerender.
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: '1 May 2027' }))
    expect(screen.getByRole('button', { name: 'Start date' })).toHaveTextContent('01.05.2027')
  })

  it('defaults and writes the day timeline window through the wheel', async () => {
    const user = userEvent.setup()
    renderInRoom(<TripModal onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Day start' })).toHaveTextContent('06:00')
    expect(screen.getByRole('button', { name: 'Day end' })).toHaveTextContent('21:00')

    await user.click(screen.getByRole('button', { name: 'Day start' }))
    await user.click(screen.getByRole('option', { name: 'Hour 07' }))
    await user.click(screen.getByRole('option', { name: 'Minute 30' }))
    await user.click(screen.getByRole('button', { name: 'Set 07:30' }))
    expect(screen.getByRole('button', { name: 'Day start' })).toHaveTextContent('07:30')
  })

  it('renders in a dialog with the seal + Lora "Trip details" heading, no slate skin', () => {
    renderInRoom(<TripModal onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Trip details' })
    expect(dialog.outerHTML).not.toMatch(/slate-/)
    expect(screen.getByRole('heading', { name: 'Trip details' })).toHaveClass('font-serif')
  })

  it('closes via Done, Escape, and backdrop click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderInRoom(<TripModal onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)

    // The backdrop is the dialog's parent element.
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
