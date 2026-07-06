import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { RoomProvider } from '../../data/RoomProvider'
import { CityModal } from './CityModal'
import { CITY_PALETTE } from './colors'

function renderInRoom(ui: ReactNode) {
  return render(
    <RoomProvider workerUrl="" token={null} enableSync={false}>
      {ui}
    </RoomProvider>,
  )
}

describe('CityModal', () => {
  it('adds a named city and lists it (live write)', () => {
    renderInRoom(<CityModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByLabelText('Name for Rome')).toHaveValue('Rome')
  })

  it('does not add a blank city', () => {
    renderInRoom(<CityModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('edits a city name and colour in place (live write)', () => {
    renderInRoom(<CityModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    fireEvent.change(screen.getByLabelText('Colour for Rome'), { target: { value: '#00ff00' } })
    expect(screen.getByLabelText('Colour for Rome')).toHaveValue('#00ff00')
  })

  it('preselects a palette colour for a new city', () => {
    renderInRoom(<CityModal onClose={() => {}} />)
    const picker = screen.getByLabelText('New city colour') as HTMLInputElement
    expect(CITY_PALETTE).toContain(picker.value)
  })

  it('re-rolls a different default colour after adding', () => {
    renderInRoom(<CityModal onClose={() => {}} />)
    const picker = () => screen.getByLabelText('New city colour') as HTMLInputElement
    const first = picker().value

    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    const second = picker().value
    expect(CITY_PALETTE).toContain(second)
    expect(second).not.toBe(first)
  })

  it('re-rolls a different colour from the ↻ button', () => {
    renderInRoom(<CityModal onClose={() => {}} />)
    const picker = () => screen.getByLabelText('New city colour') as HTMLInputElement
    const first = picker().value
    fireEvent.click(screen.getByRole('button', { name: 'Pick a different colour' }))
    expect(picker().value).not.toBe(first)
  })

  it('removes a city', () => {
    renderInRoom(<CityModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rome' }))

    expect(screen.queryByLabelText('Name for Rome')).not.toBeInTheDocument()
  })

  it('renders in a dialog with the Lora "Cities & colours" heading, no slate skin', () => {
    renderInRoom(<CityModal onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Cities & colours' })
    expect(dialog.outerHTML).not.toMatch(/slate-/)
    expect(screen.getByRole('heading', { name: 'Cities & colours' })).toHaveClass('font-serif')
  })

  it('closes via the Done button, Escape, and backdrop click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderInRoom(<CityModal onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)

    // The backdrop is the dialog's parent element.
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
