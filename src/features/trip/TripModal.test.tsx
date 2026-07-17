import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import type { ReactNode } from 'react'
import { setTrip } from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import { RoomProvider } from '../../data/RoomProvider'
import { TripModal } from './TripModal'

function renderInRoom(
  ui: ReactNode,
  { roomId = null, workerUrl = '' }: { roomId?: string | null; workerUrl?: string } = {},
) {
  return render(
    <RoomProvider workerUrl={workerUrl} roomId={roomId} enableSync={false}>
      {ui}
    </RoomProvider>,
  )
}

function sync(from: Y.Doc, to: Y.Doc) {
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)))
}

function docWithMergedInvertedWindow(): Y.Doc {
  const a = new Y.Doc()
  const b = new Y.Doc()
  setTrip(a, { title: 'Broken', startDate: '2027-05-10', endDate: '2027-05-10' })
  sync(a, b)
  setTrip(a, { dayStart: '20:00' })
  setTrip(b, { dayEnd: '07:00' })
  sync(a, b)
  sync(b, a)
  return a
}

/** Seeds a known start date once so the calendar opens on a deterministic month. */
function TripWithStart() {
  const { doc } = useRoom()
  useState(() => setTrip(doc, { startDate: '2027-05-10' }))
  return <TripModal onClose={() => {}} />
}

function TripWithMergedInvertedWindow() {
  const { doc } = useRoom()
  useState(() => Y.applyUpdate(doc, Y.encodeStateAsUpdate(docWithMergedInvertedWindow())))
  return <TripModal onClose={() => {}} />
}

describe('TripModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('writes title into the trip live', () => {
    renderInRoom(<TripModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Trip title'), { target: { value: 'Italy' } })

    expect(screen.getByLabelText('Trip title')).toHaveValue('Italy')
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

  it('shows generic repair guidance when the current trip cannot be exported', () => {
    renderInRoom(<TripWithMergedInvertedWindow />)

    const currentJson = screen.getByLabelText('Current trip JSON') as HTMLTextAreaElement
    expect(currentJson.value).toContain('inconsistent state')
    expect(currentJson.value).toContain('day window')
    expect(currentJson.value).not.toContain('city may have been removed')
  })

  it('shows an alert when version history cannot be listed', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    renderInRoom(<TripModal onClose={() => {}} />, {
      roomId: 'rome-2027',
      workerUrl: 'https://worker.test',
    })

    await user.click(screen.getByText('Trip JSON (for AI)'))
    await user.click(screen.getByText('Recent versions'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load version history.')
    expect(fetchMock).toHaveBeenCalledWith('https://worker.test/api/versions/rome-2027')
  })

  it('shows an alert when a listed version cannot be restored', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ versions: [{ id: '1000', timestamp: 1000 }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    renderInRoom(<TripModal onClose={() => {}} />, {
      roomId: 'rome-2027',
      workerUrl: 'https://worker.test',
    })

    await user.click(screen.getByText('Trip JSON (for AI)'))
    await user.click(screen.getByText('Recent versions'))
    await user.click(await screen.findByRole('button', { name: 'Restore' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load that version.')
    expect(fetchMock).toHaveBeenLastCalledWith('https://worker.test/api/versions/rome-2027/1000')
  })

  it('closes via Done, Escape, and backdrop click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderInRoom(<TripModal onClose={onClose} />)

    await user.click(screen.getAllByRole('button', { name: 'Done' })[0])
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)

    // The backdrop is the dialog's parent element.
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
