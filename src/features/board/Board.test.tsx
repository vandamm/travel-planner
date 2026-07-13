import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import * as Y from 'yjs'
import { addAccommodation, addCard, addCity, setTrip } from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import { RoomProvider } from '../../data/RoomProvider'
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
    act(() => setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-03' }))
    expect(screen.getAllByTestId('day-column')).toHaveLength(3)
  })

  it('colors a day header from its covering accommodation', () => {
    renderBoard(<Board />)
    act(() => {
      setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-02' })
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

  it('renders an accommodation bar in the lane spanning its nights', () => {
    renderBoard(<Board />)
    act(() => {
      setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-03' })
      addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
      addAccommodation(doc, {
        label: 'Hotel Roma',
        cityId: 'rome',
        startNight: '2027-05-01',
        endNight: '2027-05-02',
      })
    })
    const bar = screen.getByTestId('accommodation-bar')
    expect(bar).toHaveTextContent('Hotel Roma')
    expect(screen.getByTestId('accommodation-cell')).toHaveStyle({ gridColumn: '1 / span 2' })
  })

  it('overrides a day’s city from its header, then reverts to Auto', () => {
    renderBoard(<Board />)
    act(() => {
      setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-01' })
      addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
      addCity(doc, { id: 'florence', name: 'Florence', color: '#3b82f6' })
      addAccommodation(doc, {
        label: 'Hotel Roma',
        cityId: 'rome',
        startNight: '2027-05-01',
        endNight: '2027-05-01',
      })
    })
    const column = screen.getAllByTestId('day-column')[0]
    // Accommodation-resolved → Rome.
    expect(within(column).getByTestId('city-band')).toHaveStyle({ backgroundColor: '#ef4444' })

    // Choose Florence via the header picker → recolors the day.
    const select = within(column).getByTestId('city-override')
    act(() => {
      fireEvent.change(select, { target: { value: 'florence' } })
    })
    expect(within(column).getByTestId('city-band')).toHaveStyle({ backgroundColor: '#3b82f6' })
    expect(within(column).queryByTestId('override-indicator')).not.toBeInTheDocument()

    // Auto clears the override → back to the accommodation's Rome.
    act(() => {
      fireEvent.change(within(column).getByTestId('city-override'), { target: { value: '' } })
    })
    expect(within(column).getByTestId('city-band')).toHaveStyle({ backgroundColor: '#ef4444' })
  })

  it('opens the accommodation editor from the Add stay button', () => {
    renderBoard(<Board />)
    act(() => setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-02' }))
    act(() => screen.getByRole('button', { name: 'Add stay' }).click())
    expect(screen.getByRole('dialog', { name: 'Accommodation editor' })).toBeInTheDocument()
  })

  it('opens the editor when the Add stay nonce bumps, not on mount, and re-opens on repeat', () => {
    const wrap = (nonce: number) => (
      <RoomProvider workerUrl="" roomId={null} enableSync={false}>
        <Capture />
        <Board addStayNonce={nonce} />
      </RoomProvider>
    )
    const dialog = () => screen.queryByRole('dialog', { name: 'Accommodation editor' })
    const { rerender } = render(wrap(0))
    act(() => setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-02' }))
    // Nonce 0 on mount must not open the editor (the `> 0` guard).
    expect(dialog()).not.toBeInTheDocument()

    // A bump opens it.
    rerender(wrap(1))
    expect(dialog()).toBeInTheDocument()

    // Close it, then a repeat bump re-opens — the reason it's a nonce, not a boolean.
    act(() => fireEvent.keyDown(window, { key: 'Escape' }))
    expect(dialog()).not.toBeInTheDocument()
    rerender(wrap(2))
    expect(dialog()).toBeInTheDocument()
  })

  it('tints the toolbar buttons with ink/edge tokens, not slate', () => {
    renderBoard(<Board />)
    act(() => setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-01' }))
    expect(screen.getByRole('button', { name: 'Undo' }).querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redo' }).querySelector('svg')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Toggle time direction' })
    expect(toggle).toHaveClass('border-edge-300', 'text-ink-600', 'hover:bg-surface-chip')
    expect(toggle.className).not.toMatch(/slate-/)
    expect(screen.getByRole('heading', { name: 'Board' }).className).not.toMatch(/slate-/)
  })

  it('reverses every card in every day when the direction is toggled', () => {
    renderBoard(<Board />)
    act(() => {
      setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-01' })
      addCard(doc, { dayKey: '2027-05-01', title: 'Breakfast', startTime: '08:00' })
      addCard(doc, { dayKey: '2027-05-01', title: 'Dinner', startTime: '19:00' })
    })

    const titles = () => screen.getAllByTestId('card-title').map((n) => n.textContent)
    expect(titles()).toEqual(['Breakfast', 'Dinner'])

    act(() => screen.getByRole('button', { name: 'Toggle time direction' }).click())
    expect(titles()).toEqual(['Dinner', 'Breakfast'])
  })
})
