import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { RoomProvider } from '../../data/RoomProvider'
import { TripModal } from './TripModal'

function renderInRoom(ui: ReactNode) {
  return render(
    <RoomProvider workerUrl="" roomId={null} enableSync={false}>
      {ui}
    </RoomProvider>,
  )
}

describe('TripModal', () => {
  it('writes title, start date, and day count into the trip live', () => {
    renderInRoom(<TripModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Trip title'), { target: { value: 'Italy' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-05-01' } })
    fireEvent.change(screen.getByLabelText('Number of days'), { target: { value: '12' } })

    expect(screen.getByLabelText('Trip title')).toHaveValue('Italy')
    expect(screen.getByLabelText('Start date')).toHaveValue('2027-05-01')
    expect(screen.getByLabelText('Number of days')).toHaveValue(12)
  })

  it('defaults and writes the day timeline window', () => {
    renderInRoom(<TripModal onClose={() => {}} />)
    expect(screen.getByLabelText('Day start')).toHaveValue('06:00')
    expect(screen.getByLabelText('Day end')).toHaveValue('21:00')

    fireEvent.change(screen.getByLabelText('Day start'), { target: { value: '07:30' } })
    fireEvent.change(screen.getByLabelText('Day end'), { target: { value: '22:00' } })

    expect(screen.getByLabelText('Day start')).toHaveValue('07:30')
    expect(screen.getByLabelText('Day end')).toHaveValue('22:00')
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
