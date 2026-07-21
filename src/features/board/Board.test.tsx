import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import * as Y from 'yjs'
import {
  addAccommodation,
  addCard,
  addCity,
  listAccommodations,
  setTrip,
} from '../../data/doc'
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

  it('overrides a day’s city from its header, then reverts to Auto', async () => {
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
    fireEvent.click(within(column).getByRole('button', { name: 'Choose city' }))
    fireEvent.click(screen.getByRole('button', { name: /Florence/ }))
    expect(within(column).getByTestId('city-band')).toHaveStyle({ backgroundColor: '#3b82f6' })
    expect(within(column).queryByTestId('override-indicator')).not.toBeInTheDocument()

    // Auto clears the override → back to the accommodation's Rome.
    fireEvent.click(within(column).getByRole('button', { name: 'Choose city' }))
    fireEvent.click(screen.getByRole('button', { name: /Auto/ }))
    expect(within(column).getByTestId('city-band')).toHaveStyle({ backgroundColor: '#ef4444' })
  })

  it('opens a day-swap dialog and confirms one atomic desktop swap', () => {
    renderBoard(<Board />)
    act(() => {
      setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-02' })
      addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
      addCity(doc, { id: 'florence', name: 'Florence', color: '#3b82f6' })
      addAccommodation(doc, {
        id: 'rome-stay',
        label: 'Hotel Roma',
        cityId: 'rome',
        startNight: '2027-05-01',
        endNight: '2027-05-01',
      })
      addAccommodation(doc, {
        id: 'florence-stay',
        label: 'Hotel Firenze',
        cityId: 'florence',
        startNight: '2027-05-02',
        endNight: '2027-05-02',
      })
      addCard(doc, { id: 'rome-card', dayKey: '2027-05-01', title: 'Rome tour' })
      addCard(doc, { id: 'florence-card', dayKey: '2027-05-02', title: 'Florence walk' })
    })
    const accommodationsBefore = JSON.stringify(listAccommodations(doc))
    const firstColumn = screen.getAllByTestId('day-column')[0]

    act(() => {
      within(firstColumn).getByRole('button', { name: 'Swap day' }).click()
    })
    const dialog = screen.getByRole('dialog', { name: 'Swap activity day' })
    expect(within(dialog).getByTestId('swap-source')).toHaveTextContent('Rome')
    expect(within(dialog).getByTestId('swap-target')).toHaveTextContent('Florence')

    let updates = 0
    doc.on('update', () => {
      updates += 1
    })
    act(() => {
      within(dialog).getByRole('button', { name: 'Swap days' }).click()
    })

    expect(updates).toBe(1)
    expect(screen.queryByRole('dialog', { name: 'Swap activity day' })).not.toBeInTheDocument()
    const [firstAfter, secondAfter] = screen.getAllByTestId('day-column')
    expect(within(firstAfter).getByTestId('city-name')).toHaveTextContent('Florence')
    expect(within(firstAfter).getByTestId('card-title')).toHaveTextContent('Florence walk')
    expect(within(secondAfter).getByTestId('city-name')).toHaveTextContent('Rome')
    expect(within(secondAfter).getByTestId('card-title')).toHaveTextContent('Rome tour')
    expect(JSON.stringify(listAccommodations(doc))).toBe(accommodationsBefore)
  })

  it('has no toolbar or trailing Add stay button on desktop', () => {
    renderBoard(<Board />)
    act(() => setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-02' }))
    expect(within(screen.getByTestId('board-toolbar')).queryByRole('button', { name: 'Add stay' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('add-stay')).not.toBeInTheDocument()
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

  it('puts controls inside the board toolbar instead of a separate Board heading', () => {
    renderBoard(<Board />)
    act(() => setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-01' }))
    expect(screen.getByTestId('board-frame')).toContainElement(screen.getByTestId('board-toolbar'))
    expect(screen.queryByRole('heading', { name: 'Board' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Toggle time direction' })
    expect(toggle).toHaveClass('border-edge-350', 'text-ink-600')
    expect(toggle.className).not.toMatch(/slate-/)
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
