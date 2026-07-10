import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState, type ReactNode } from 'react'
import * as Y from 'yjs'
import { addAccommodation, addCity, listAccommodations } from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import { RoomProvider } from '../../data/RoomProvider'
import type { Accommodation } from '../../data/schema'
import { AccommodationEditor } from './AccommodationEditor'

let doc: Y.Doc

function Capture() {
  doc = useRoom().doc
  return null
}

function renderEditor(ui: ReactNode) {
  return render(
    <RoomProvider workerUrl="" roomId={null} enableSync={false}>
      <Capture />
      {ui}
    </RoomProvider>,
  )
}

/** Seeds a city once (lazy init) before rendering the editor in create mode. */
function CreateMode() {
  const { doc: d } = useRoom()
  useState(() => addCity(d, { id: 'rome', name: 'Rome', color: '#ef4444' }))
  return (
    <AccommodationEditor defaultStartNight="2027-05-01" defaultEndNight="2027-05-01" onClose={() => {}} />
  )
}

/** Seeds one stay once (lazy init) and opens the editor on it in edit mode. */
function EditMode() {
  const { doc: d } = useRoom()
  const [acc] = useState<Accommodation>(() =>
    addAccommodation(d, {
      id: 'stay-1',
      label: 'Old Inn',
      startNight: '2027-05-02',
      endNight: '2027-05-03',
    }),
  )
  return <AccommodationEditor accommodation={acc} onClose={() => {}} />
}

describe('AccommodationEditor', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('creates an accommodation from the form', async () => {
    const user = userEvent.setup()
    renderEditor(<CreateMode />)

    await user.type(screen.getByLabelText('Accommodation label'), 'Hotel Roma')
    await user.selectOptions(screen.getByLabelText('City'), 'rome')
    // Pick a first→last range through the calendar (seeded to May 2027).
    await user.click(screen.getByRole('button', { name: 'Stay nights' }))
    await user.click(screen.getByRole('button', { name: '1 May 2027' }))
    await user.click(screen.getByRole('button', { name: '3 May 2027' }))
    await user.click(screen.getByRole('button', { name: 'Save stay' }))

    const stays = listAccommodations(doc)
    expect(stays).toHaveLength(1)
    expect(stays[0]).toMatchObject({
      label: 'Hotel Roma',
      cityId: 'rome',
      startNight: '2027-05-01',
      endNight: '2027-05-03',
    })
  })

  it('swaps a last-before-first range so start <= end', async () => {
    const user = userEvent.setup()
    renderEditor(<CreateMode />)

    await user.type(screen.getByLabelText('Accommodation label'), 'Swapped')
    // Pick the later night first, then an earlier one — the picker swaps them.
    await user.click(screen.getByRole('button', { name: 'Stay nights' }))
    await user.click(screen.getByRole('button', { name: '5 May 2027' }))
    await user.click(screen.getByRole('button', { name: '1 May 2027' }))
    await user.click(screen.getByRole('button', { name: 'Save stay' }))

    expect(listAccommodations(doc)[0]).toMatchObject({
      startNight: '2027-05-01',
      endNight: '2027-05-05',
    })
  })

  it('edits an existing accommodation', async () => {
    const user = userEvent.setup()
    renderEditor(<EditMode />)

    expect(screen.getByLabelText('Accommodation label')).toHaveValue('Old Inn')
    await user.clear(screen.getByLabelText('Accommodation label'))
    await user.type(screen.getByLabelText('Accommodation label'), 'New Inn')
    await user.click(screen.getByRole('button', { name: 'Save stay' }))

    expect(listAccommodations(doc)).toHaveLength(1)
    expect(listAccommodations(doc)[0].label).toBe('New Inn')
  })

  it('deletes an existing accommodation', async () => {
    const user = userEvent.setup()
    renderEditor(<EditMode />)

    expect(listAccommodations(doc)).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Delete stay' }))
    expect(listAccommodations(doc)).toHaveLength(0)
  })

  it('uses ink/type tokens, not the old slate skin', () => {
    renderEditor(<CreateMode />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.outerHTML).not.toMatch(/slate-/)
    // Heading is Lora (serif) per the ink & type mock.
    expect(screen.getByRole('heading', { name: 'Add stay' })).toHaveClass('font-serif')
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <RoomProvider workerUrl="" roomId={null} enableSync={false}>
        <AccommodationEditor onClose={onClose} />
      </RoomProvider>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
