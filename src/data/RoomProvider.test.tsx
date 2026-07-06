import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as provider from './provider'
import { RoomProvider, useRoom } from './RoomProvider'
import { addCity, listCities } from './doc'
import { encodePayload } from './token'

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

// Surfaces the capability values the provider decodes from the token.
function PermProbe() {
  const { roomId, perm, name } = useRoom()
  return (
    <div>
      <span data-testid="room">{roomId ?? '∅'}</span>
      <span data-testid="perm">{perm ?? '∅'}</span>
      <span data-testid="name">{name ?? '∅'}</span>
    </div>
  )
}

describe('RoomProvider', () => {
  it('provides a local-first doc and status to consumers', () => {
    render(
      <RoomProvider workerUrl="" token={null} enableSync={false}>
        <Consumer />
      </RoomProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('local')
    expect(screen.getByTestId('room')).toHaveTextContent('none')
    expect(screen.getByTestId('cities')).toHaveTextContent('Rome')
  })

  it('decodes room, perm and name from a passed token', () => {
    const token = encodePayload({ r: 'rome-2027', p: 'view', n: 'Ada', v: 1 })
    render(
      <RoomProvider workerUrl="" token={token} enableSync={false}>
        <PermProbe />
      </RoomProvider>,
    )
    expect(screen.getByTestId('room')).toHaveTextContent('rome-2027')
    expect(screen.getByTestId('perm')).toHaveTextContent('view')
    expect(screen.getByTestId('name')).toHaveTextContent('Ada')
  })

  it('accepts a `#<token>` fragment and defaults an absent name to null', () => {
    const token = '#' + encodePayload({ r: 'e2e', p: 'edit', v: 1 })
    render(
      <RoomProvider workerUrl="" token={token} enableSync={false}>
        <PermProbe />
      </RoomProvider>,
    )
    expect(screen.getByTestId('room')).toHaveTextContent('e2e')
    expect(screen.getByTestId('perm')).toHaveTextContent('edit')
    expect(screen.getByTestId('name')).toHaveTextContent('∅')
  })

  it('exposes null room/perm for an undecodable (legacy `#room=…`) token', () => {
    render(
      <RoomProvider workerUrl="" token="room=legacy" enableSync={false}>
        <PermProbe />
      </RoomProvider>,
    )
    expect(screen.getByTestId('room')).toHaveTextContent('∅')
    expect(screen.getByTestId('perm')).toHaveTextContent('∅')
  })

  it('builds the connection inside an effect, not during render (StrictMode-safe)', () => {
    // The connection is an external resource with a one-way destroy(). If it is
    // built in render/useMemo, StrictMode's mount→unmount→remount destroys it on
    // the fake unmount and never rebuilds it (the effect re-run reuses the dead,
    // memoized connection) — leaving the app wired to a torn-down connection with
    // no sync. Building it in the effect keeps create/destroy symmetric, so a
    // remount rebuilds it. Guard: connectRoom must not run during render.
    const spy = vi.spyOn(provider, 'connectRoom')
    let callsDuringRender = -1
    function Probe() {
      // Renders after RoomProvider's render (incl. its useMemo) but before effects
      // flush, so a render-built connection would already be counted here.
      if (callsDuringRender === -1) callsDuringRender = spy.mock.calls.length
      return null
    }
    render(
      <RoomProvider workerUrl="" token={null} enableSync={false}>
        <Probe />
      </RoomProvider>,
    )
    expect(callsDuringRender).toBe(0)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
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
