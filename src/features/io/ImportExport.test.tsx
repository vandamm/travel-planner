import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import * as Y from 'yjs'
import { addCity, listCards, listCities } from '../../data/doc'
import { RoomProvider, useRoom } from '../../data/RoomProvider'
import { ImportExport } from './ImportExport'

let doc: Y.Doc

function Capture() {
  doc = useRoom().doc
  return null
}

function renderIO(seed?: (d: Y.Doc) => void) {
  function Seed() {
    const { doc: d } = useRoom()
    useState(() => seed?.(d))
    return null
  }
  return render(
    <RoomProvider workerUrl="" roomId={null} enableSync={false}>
      <Capture />
      <Seed />
      <ImportExport />
    </RoomProvider>,
  )
}

const TRIP_JSON = JSON.stringify({
  trip: { title: 'Italy 2027', startDate: '2027-05-01', numDays: 3 },
  cities: [{ id: 'rome', name: 'Rome', color: '#ef4444' }],
  cards: [{ id: 'card-1', dayKey: '2027-05-01', title: 'Colosseum', order: 0 }],
})

describe('ImportExport', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('imports pasted JSON into the doc', async () => {
    const user = userEvent.setup()
    renderIO()

    await user.click(screen.getByRole('button', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Trip JSON'))
    await user.paste(TRIP_JSON)
    await user.click(screen.getByRole('button', { name: 'Import trip' }))

    expect(listCities(doc).map((c) => c.name)).toEqual(['Rome'])
    expect(listCards(doc).map((c) => c.title)).toEqual(['Colosseum'])
    expect(screen.getByRole('status')).toHaveTextContent(/imported/i)
  })

  it('surfaces a clear error for malformed JSON and leaves the doc untouched', async () => {
    const user = userEvent.setup()
    renderIO()

    await user.click(screen.getByRole('button', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Trip JSON'))
    await user.paste('{ not valid')
    await user.click(screen.getByRole('button', { name: 'Import trip' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(listCities(doc)).toHaveLength(0)
  })

  it('downloads an export when there is a trip', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

    const user = userEvent.setup()
    renderIO((d) => addCity(d, { id: 'rome', name: 'Rome', color: '#ef4444' }))

    await user.click(screen.getByRole('button', { name: 'Export trip' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })
})
