import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import * as Y from 'yjs'
import { addAccommodation, addCard, addCity, setTrip } from '../../data/doc'
import { RoomProvider, useRoom } from '../../data/RoomProvider'
import { Board } from './Board'

let doc: Y.Doc

function Capture() {
  doc = useRoom().doc
  return null
}

function renderBoard(ui: ReactNode) {
  return render(
    <RoomProvider workerUrl="" roomId={null} enableSync={false}>
      <Capture />
      {ui}
    </RoomProvider>,
  )
}

describe('Board', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('prompts to set up the trip when there are no days', () => {
    renderBoard(<Board />)
    expect(screen.getByTestId('board-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('day-column')).not.toBeInTheDocument()
  })

  it('renders one column per day once the trip is set up', () => {
    renderBoard(<Board />)
    act(() => setTrip(doc, { startDate: '2027-05-01', numDays: 3 }))
    expect(screen.getAllByTestId('day-column')).toHaveLength(3)
  })

  it('colors a day header from its covering accommodation', () => {
    renderBoard(<Board />)
    act(() => {
      setTrip(doc, { startDate: '2027-05-01', numDays: 2 })
      addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
      addAccommodation(doc, {
        label: 'Hotel Roma',
        cityId: 'rome',
        startNight: '2027-05-01',
        endNight: '2027-05-01',
      })
    })
    const firstColumn = screen.getAllByTestId('day-column')[0]
    expect(within(firstColumn).getByTestId('city-name')).toHaveTextContent('Rome')
    expect(within(firstColumn).getByTestId('city-band')).toHaveStyle({
      backgroundColor: '#ef4444',
    })
  })

  it('reverses every card in every day when the direction is toggled', () => {
    renderBoard(<Board />)
    act(() => {
      setTrip(doc, { startDate: '2027-05-01', numDays: 1 })
      addCard(doc, { dayKey: '2027-05-01', title: 'Breakfast', startTime: '08:00' })
      addCard(doc, { dayKey: '2027-05-01', title: 'Dinner', startTime: '19:00' })
    })

    const titles = () => screen.getAllByTestId('card-title').map((n) => n.textContent)
    expect(titles()).toEqual(['Breakfast', 'Dinner'])

    act(() => screen.getByRole('button', { name: 'Toggle time direction' }).click())
    expect(titles()).toEqual(['Dinner', 'Breakfast'])
  })
})
