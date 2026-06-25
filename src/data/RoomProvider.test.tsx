import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoomProvider, useRoom } from './RoomProvider'
import { addCity, listCities } from './doc'

function Consumer() {
  const { doc, status, roomId } = useRoom()
  // Exercise the doc to prove it is a real, mutable Y.Doc.
  if (listCities(doc).length === 0) addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="room">{roomId ?? 'none'}</span>
      <span data-testid="cities">{listCities(doc).map((c) => c.name).join(',')}</span>
    </div>
  )
}

describe('RoomProvider', () => {
  it('provides a local-first doc and status to consumers', () => {
    render(
      <RoomProvider workerUrl="" roomId={null} enableSync={false}>
        <Consumer />
      </RoomProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('local')
    expect(screen.getByTestId('room')).toHaveTextContent('none')
    expect(screen.getByTestId('cities')).toHaveTextContent('Rome')
  })

  it('throws when useRoom is used outside a provider', () => {
    function Orphan() {
      useRoom()
      return null
    }
    // Suppress React's error boundary console noise for the expected throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Orphan />)).toThrow(/useRoom/)
    spy.mockRestore()
  })
})
