import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { addCard, listCards } from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import { RoomProvider } from '../../data/RoomProvider'
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
          {JSON.stringify({
            title: c.title,
            startTime: c.startTime,
            duration: c.duration,
            durationHours: c.durationHours,
            note: c.note,
            link: c.link,
            transport: c.transport,
            category: c.category,
          })}
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
    setCard(
      addCard(doc, {
        dayKey: '2027-05-01',
        title: 'Old title',
        note: 'old note',
        startTime: '09:00',
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <CardDump />
      {card && <CardEditor card={card} onClose={() => undefined} />}
    </>
  )
}

/** Edit-mode harness seeded with a half-day card. */
function HalfDayEditHarness() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const [card, setCard] = useState<Card | null>(null)
  useEffect(() => {
    setCard(addCard(doc, { dayKey: '2027-05-01', title: 'Siesta', duration: 'half' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <CardDump />
      {card && <CardEditor card={card} onClose={() => undefined} />}
    </>
  )
}

/** Edit-mode harness seeded with a transport card. */
function TransportEditHarness() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const [card, setCard] = useState<Card | null>(null)
  useEffect(() => {
    setCard(addCard(doc, { dayKey: '2027-05-01', title: 'Flight', transport: true }))
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

  it('disables Save until the title is non-blank', () => {
    renderInRoom(<CreateHarness />)
    const save = screen.getByRole('button', { name: 'Save card' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: ' Museum ' } })
    expect(save).toBeEnabled()
  })

  it('captures a note and quarter-hour start through the always-present time field', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Train' } })
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'platform 4' } })
    // The field is always shown (the "Set a start time" checkbox is gone); an
    // empty value is what makes the card untimed.
    const start = screen.getByLabelText('Start time')
    expect(start).toHaveAttribute('type', 'time')
    expect(start).toHaveAttribute('step', '900')
    expect(start).toHaveValue('')
    fireEvent.change(start, { target: { value: '10:15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Train')) ?? ''
    expect(row).toContain('"startTime":"10:15"')
    expect(row).toContain('"duration":"custom"')
    expect(row).toContain('"durationHours":1')
    expect(row).toContain('"note":"platform 4"')
  })

  it('shows the derived end time once a start is set', () => {
    renderInRoom(<CreateHarness />)
    expect(screen.getByTestId('when-derived')).toHaveTextContent(
      'optional — you can place it later',
    )
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '09:00' } })
    expect(screen.getByTestId('when-derived')).toHaveTextContent('ends 10:00 · derived')
  })

  it('stores a link entered in the link field', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Booking' } })
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Booking')) ?? ''
    expect(row).toContain('"link":"https://example.com"')
  })

  it('keeps the start time optional', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Loose end' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Loose end')) ?? ''
    expect(row).not.toContain('"startTime":"')
    expect(row).toContain('"durationHours":1')
  })

  it('saves the category chosen from the Type control', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Flight' } })
    fireEvent.click(screen.getByRole('button', { name: 'Transport' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Flight')) ?? ''
    expect(row).toContain('"category":"transit"')
  })

  it('toggles a Type segment off when reclicked, storing no category', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Park' } })
    const outdoor = screen.getByRole('button', { name: 'Outdoors' })
    fireEvent.click(outdoor)
    expect(outdoor).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(outdoor)
    expect(outdoor).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Park')) ?? ''
    expect(row).not.toContain('"category":"')
  })

  it('stores a whole-day duration from the All day switch', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'All day' } })
    const allDay = screen.getByRole('switch', { name: 'All day' })
    expect(allDay).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(allDay)
    expect(allDay).toHaveAttribute('aria-checked', 'true')
    // Switched on, the hour/minute fields show the trip window and go read-only.
    expect(screen.getByLabelText('Duration hours')).toBeDisabled()
    expect(screen.getByLabelText('Duration hours')).toHaveValue(15)
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('All day')) ?? ''
    expect(row).toContain('"duration":"day"')
  })

  it('defaults new cards to one hour and takes a length as hours plus minutes', () => {
    renderInRoom(<CreateHarness />)
    const hours = screen.getByLabelText('Duration hours')
    const minutes = screen.getByLabelText('Duration minutes')
    expect(hours).toHaveValue(1)
    expect(minutes).toHaveValue(0)
    expect(minutes).toHaveAttribute('step', '15')

    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Plain' } })
    fireEvent.change(hours, { target: { value: '2' } })
    fireEvent.change(minutes, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Plain')) ?? ''
    expect(row).toContain('"duration":"custom"')
    expect(row).toContain('"durationHours":2.5')
  })

  it('keeps a stored half-day card on half until its length is actually edited', async () => {
    renderInRoom(<HalfDayEditHarness />)
    // A 06:00–21:00 window halves to 7h 30m.
    await waitFor(() => expect(screen.getByLabelText('Duration hours')).toHaveValue(7))
    expect(screen.getByLabelText('Duration minutes')).toHaveValue(30)

    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
    await waitFor(() => {
      const row = rows().find((r) => r.includes('Siesta')) ?? ''
      expect(row).toContain('"duration":"half"')
    })

    fireEvent.change(screen.getByLabelText('Duration hours'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
    await waitFor(() => {
      const row = rows().find((r) => r.includes('Siesta')) ?? ''
      expect(row).toContain('"duration":"custom"')
      expect(row).toContain('"durationHours":3.5')
    })
  })

  it('keeps an activity untimed when Start time is blank', () => {
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

  it('renders an aria-labelled dialog and closes on Escape', async () => {
    const user = userEvent.setup()
    renderInRoom(<CreateHarness />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Card editor')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

  it('pre-selects Transport for a legacy transport card and rewrites it to category on save', async () => {
    renderInRoom(<TransportEditHarness />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Transport' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    await waitFor(() => {
      const row = rows().find((r) => r.includes('Flight')) ?? ''
      expect(row).toContain('"category":"transit"')
      expect(row).not.toContain('"transport":true')
    })
  })

  it('untimes the card when the native start time is cleared', async () => {
    renderInRoom(<EditHarness />)
    await waitFor(() => expect(screen.getByLabelText('Start time')).toHaveValue('09:00'))

    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '' } })
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
