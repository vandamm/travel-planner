import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

/** Open a time-wheel trigger, pick hour + minute, and commit via "Set HH:mm". */
async function setTimeViaWheel(
  user: ReturnType<typeof userEvent.setup>,
  trigger: string,
  hour: string,
  minute: string,
) {
  await user.click(screen.getByRole('button', { name: trigger }))
  await user.click(screen.getByRole('option', { name: `Hour ${hour}` }))
  await user.click(screen.getByRole('option', { name: `Minute ${minute}` }))
  await user.click(screen.getByRole('button', { name: `Set ${hour}:${minute}` }))
}

describe('CardEditor — create', () => {
  it('adds a card with a title to the target day', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Museum' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    expect(rows().some((r) => r.includes('Museum'))).toBe(true)
  })

  it('does not add a card with a blank title', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    expect(screen.queryAllByTestId('dump-row')).toHaveLength(0)
  })

  it('disables Save until the title is non-blank', () => {
    renderInRoom(<CreateHarness />)
    const save = screen.getByRole('button', { name: 'Save card' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Museum ' } })
    expect(save).toBeEnabled()
  })

  it('captures a note and optional start time', async () => {
    const user = userEvent.setup()
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Train' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'platform 4' } })
    await setTimeViaWheel(user, 'Start time', '10', '00')
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Train')) ?? ''
    expect(row).toContain('"startTime":"10:00"')
    expect(row).toContain('"duration":"custom"')
    expect(row).toContain('"durationHours":1')
    expect(row).toContain('"note":"platform 4"')
  })

  it('stores a link entered in the link field', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Booking' } })
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Booking')) ?? ''
    expect(row).toContain('"link":"https://example.com"')
  })

  it('keeps the start time optional', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Loose end' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Loose end')) ?? ''
    expect(row).not.toContain('"startTime":"')
    expect(row).toContain('"durationHours":1')
  })

  it('saves the category chosen from the Type control', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Flight' } })
    fireEvent.click(screen.getByRole('button', { name: 'Transit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Flight')) ?? ''
    expect(row).toContain('"category":"transit"')
  })

  it('toggles a Type segment off when reclicked, storing no category', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Park' } })
    const outdoor = screen.getByRole('button', { name: 'Outdoor' })
    fireEvent.click(outdoor)
    expect(outdoor).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(outdoor)
    expect(outdoor).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Park')) ?? ''
    expect(row).not.toContain('"category":"')
  })

  it('stores a day duration chosen from the Duration control', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'All day' } })
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('All day')) ?? ''
    expect(row).toContain('"duration":"day"')
  })

  it('defaults new cards to a one-hour custom duration and accepts quarter-hour increments', () => {
    renderInRoom(<CreateHarness />)
    const duration = screen.getByRole('group', { name: 'Duration' })
    const durationHours = within(duration).getByLabelText('Duration hours')
    expect(durationHours).toHaveAttribute('min', '0.25')
    expect(durationHours).toHaveAttribute('step', '0.25')
    expect(within(duration).getByText('h')).toBeInTheDocument()
    expect(duration).toHaveClass('items-center')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Plain' } })
    fireEvent.change(durationHours, { target: { value: '0.25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Plain')) ?? ''
    expect(row).toContain('"duration":"custom"')
    expect(row).toContain('"durationHours":0.25')
  })

  it('keeps an activity untimed when Start time is blank', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Wander' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    const row = rows().find((r) => r.includes('Wander')) ?? ''
    expect(row).not.toContain('startTime')
  })

  it('closes after saving', () => {
    renderInRoom(<CreateHarness />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Museum' } })
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
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Old title'))

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    await waitFor(() => expect(rows().some((r) => r.includes('New title'))).toBe(true))
    expect(rows().some((r) => r.includes('Old title'))).toBe(false)
  })

  it('pre-selects Transit for a legacy transport card and rewrites it to category on save', async () => {
    renderInRoom(<TransportEditHarness />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Transit' })).toHaveAttribute(
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

  it('untimes the card when the start time is cleared in the wheel', async () => {
    const user = userEvent.setup()
    renderInRoom(<EditHarness />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start time' })).toHaveTextContent('09:00'),
    )

    await user.click(screen.getByRole('button', { name: 'Start time' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
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
