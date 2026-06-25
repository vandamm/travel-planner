import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { addCard, listCards } from '../../data/doc'
import { RoomProvider, useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'
import type { Card } from '../../data/schema'
import { CardEditor } from './CardEditor'

function renderInRoom(ui: ReactNode) {
  return render(
    <RoomProvider workerUrl="" roomId={null} enableSync={false}>
      {ui}
    </RoomProvider>,
  )
}

/** Dumps every card in the doc so tests can assert the mutated state. */
function CardDump() {
  const { doc } = useRoom()
  useDocVersion(doc)
  return (
    <ul aria-label="card dump">
      {listCards(doc).map((c) => (
        <li key={c.id} data-testid="dump-row">
          {JSON.stringify({ title: c.title, startTime: c.startTime, endTime: c.endTime, note: c.note })}
        </li>
      ))}
    </ul>
  )
}

/** Create-mode harness: a fresh editor targeting one day. */
function CreateHarness() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <CardDump />
      {open && <CardEditor dayKey="2027-05-01" onClose={() => setOpen(false)} />}
    </>
  )
}

/** Edit-mode harness: seeds a card, then opens the editor on it. */
function EditHarness() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const [card, setCard] = useState<Card | null>(null)
  useEffect(() => {
    setCard(addCard(doc, { dayKey: '2027-05-01', title: 'Old title', note: 'old note', startTime: '09:00' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <CardDump />
      {card && <CardEditor card={card} onClose={() => undefined} />}
    </>
  )
}

function rows() {
  return screen.getAllByTestId('dump-row').map((n) => n.textContent ?? '')
}

describe('CardEditor — create', () => {
  it('adds a card with a title to the target day', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Museum' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    expect(rows().some((r) => r.includes('Museum'))).toBe(true)
  })

  it('does not add a card with a blank title', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    expect(screen.queryAllByTestId('dump-row')).toHaveLength(0)
  })

  it('captures note and an optional start/end time when timed', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Train' } })
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'platform 4' } })
    fireEvent.click(screen.getByLabelText('Set a time'))
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '12:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Train')) ?? ''
    expect(row).toContain('"startTime":"10:00"')
    expect(row).toContain('"endTime":"12:30"')
    expect(row).toContain('"note":"platform 4"')
  })

  it('omits the time fields when the time toggle is off', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Wander' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Wander')) ?? ''
    expect(row).not.toContain('startTime')
  })

  it('closes after saving', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Museum' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
    expect(screen.queryByRole('button', { name: 'Save card' })).not.toBeInTheDocument()
  })
})

describe('CardEditor — edit', () => {
  it('pre-fills the form from the card and updates it', async () => {
    renderInRoom(<EditHarness />)
    await waitFor(() => expect(screen.getByLabelText('Card title')).toHaveValue('Old title'))

    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'New title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    await waitFor(() => expect(rows().some((r) => r.includes('New title'))).toBe(true))
    expect(rows().some((r) => r.includes('Old title'))).toBe(false)
  })

  it('clears the time when the timed toggle is switched off', async () => {
    renderInRoom(<EditHarness />)
    await waitFor(() => expect(screen.getByLabelText('Start time')).toHaveValue('09:00'))

    fireEvent.click(screen.getByLabelText('Set a time'))
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    await waitFor(() => expect(rows().some((r) => r.includes('"startTime"'))).toBe(false))
  })

  it('deletes the card', async () => {
    renderInRoom(<EditHarness />)
    await waitFor(() => expect(screen.getAllByTestId('dump-row')).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Delete card' }))

    await waitFor(() => expect(screen.queryAllByTestId('dump-row')).toHaveLength(0))
  })
})
