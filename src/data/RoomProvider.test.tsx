import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import * as provider from './provider'
import { useRoom } from './RoomContext'
import { RoomProvider } from './RoomProvider'
import { addCity, listCities } from './doc'

function Consumer() {
  const { doc, status, roomId } = useRoom()
  // Exercise the doc to prove it is a real, mutable Y.Doc.
  if (listCities(doc).length === 0) addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="room">{roomId ?? 'none'}</span>
      <span data-testid="cities">
        {listCities(doc)
          .map((c) => c.name)
          .join(',')}
      </span>
    </div>
  )
}

function RoomProbe() {
  const { roomId } = useRoom()
  return (
    <div>
      <span data-testid="room">{roomId ?? '∅'}</span>
    </div>
  )
}

function PresenceProbe() {
  const { myself, presences, setPresence } = useRoom()
  return (
    <div>
      <span data-testid="myself">{myself?.name}</span>
      <span data-testid="presence-count">{presences.length}</span>
      <button type="button" onClick={() => setPresence({ name: 'Anna' })}>
        Rename
      </button>
    </div>
  )
}

describe('RoomProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

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

  it('uses a passed room slug', () => {
    render(
      <RoomProvider workerUrl="" roomId="rome-2027" enableSync={false}>
        <RoomProbe />
      </RoomProvider>,
    )
    expect(screen.getByTestId('room')).toHaveTextContent('rome-2027')
  })

  it('starts background sync for a production same-origin room', () => {
    vi.stubEnv('MODE', 'production')
    const doc = new Y.Doc()
    const spy = vi.spyOn(provider, 'connectRoom').mockReturnValue({
      doc,
      whenLocalLoaded: Promise.resolve(),
      getStatus: () => 'local',
      onStatus: () => () => undefined,
      getPresences: () => [],
      onPresences: () => () => undefined,
      updatePresence: () => undefined,
      destroy: () => undefined,
    })
    render(
      <RoomProvider workerUrl="" roomId="rome-2027">
        <RoomProbe />
      </RoomProvider>,
    )
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ enableSync: true }))
    spy.mockRestore()
  })

  it('includes the current user once and publishes subsequent presence updates', async () => {
    const user = userEvent.setup()
    const updatePresence = vi.fn()
    const doc = new Y.Doc()
    const spy = vi.spyOn(provider, 'connectRoom').mockReturnValue({
      doc,
      whenLocalLoaded: Promise.resolve(),
      getStatus: () => 'local',
      onStatus: () => () => undefined,
      getPresences: () => [],
      onPresences: () => () => undefined,
      updatePresence,
      destroy: () => undefined,
    })
    render(
      <RoomProvider workerUrl="" roomId="rome-2027" enableSync={false}>
        <PresenceProbe />
      </RoomProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('presence-count')).toHaveTextContent('1'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByTestId('myself')).toHaveTextContent('Anna')
    expect(updatePresence).toHaveBeenCalledWith({ name: 'Anna' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ initialPresence: expect.any(Object) }))
    spy.mockRestore()
  })

  it('shows a loading state until IndexedDB has restored the local document', async () => {
    vi.stubGlobal('indexedDB', {})
    let resolveLoaded!: () => void
    const whenLocalLoaded = new Promise<void>((resolve) => {
      resolveLoaded = resolve
    })
    const doc = new (await import('yjs')).Doc()
    const spy = vi.spyOn(provider, 'connectRoom').mockReturnValue({
      doc,
      whenLocalLoaded,
      getStatus: () => 'local',
      onStatus: () => () => undefined,
      getPresences: () => [],
      onPresences: () => () => undefined,
      updatePresence: () => undefined,
      destroy: () => undefined,
    })

    render(
      <RoomProvider workerUrl="" roomId="rome-2027" enableSync={false}>
        <span>Loaded board</span>
      </RoomProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(screen.queryByText('Loaded board')).not.toBeInTheDocument()

    resolveLoaded()
    expect(await screen.findByText('Loaded board')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('reads the room slug from the current path', () => {
    const previousUrl = window.location.href
    try {
      window.history.replaceState(null, '', '/e2e')
      render(
        <RoomProvider workerUrl="" enableSync={false}>
          <RoomProbe />
        </RoomProvider>,
      )
      expect(screen.getByTestId('room')).toHaveTextContent('e2e')
    } finally {
      window.history.replaceState(null, '', previousUrl)
    }
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
      <RoomProvider workerUrl="" roomId={null} enableSync={false}>
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
