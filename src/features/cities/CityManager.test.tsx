import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { RoomProvider } from '../../data/RoomProvider'
import { CityManager } from './CityManager'
import { CITY_PALETTE } from './colors'

function renderInRoom(ui: ReactNode) {
  return render(
    <RoomProvider workerUrl="" roomId={null} enableSync={false}>
      {ui}
    </RoomProvider>,
  )
}

describe('CityManager', () => {
  it('adds a named city and lists it', () => {
    renderInRoom(<CityManager />)
    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }))

    expect(screen.getByLabelText('Name for Rome')).toHaveValue('Rome')
  })

  it('does not add a blank city', () => {
    renderInRoom(<CityManager />)
    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }))

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('edits a city colour in place', () => {
    renderInRoom(<CityManager />)
    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }))

    fireEvent.change(screen.getByLabelText('Colour for Rome'), { target: { value: '#00ff00' } })
    expect(screen.getByLabelText('Colour for Rome')).toHaveValue('#00ff00')
  })

  it('preselects a palette colour for a new city', () => {
    renderInRoom(<CityManager />)
    const picker = screen.getByLabelText('New city colour') as HTMLInputElement
    expect(CITY_PALETTE).toContain(picker.value)
  })

  it('re-rolls a different default colour after adding', () => {
    renderInRoom(<CityManager />)
    const picker = () => screen.getByLabelText('New city colour') as HTMLInputElement
    const first = picker().value

    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }))

    const second = picker().value
    expect(CITY_PALETTE).toContain(second)
    expect(second).not.toBe(first)
  })

  it('removes a city', () => {
    renderInRoom(<CityManager />)
    fireEvent.change(screen.getByLabelText('New city name'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rome' }))

    expect(screen.queryByLabelText('Name for Rome')).not.toBeInTheDocument()
  })
})
