import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { Card as CardType } from '../../data/schema'
import {
  CardResizeContext,
  type CardResizeController,
  type CardResizePlan,
} from '../board/cardResize'
import { MIN_PX_PER_HOUR } from './cardHeight'
import { Card, SortableCard } from './Card'

// Two hours (120px) so the card is tall enough for the stacked layout; a card
// of an hour or less collapses to a single line and drops its secondary rows.
const base: CardType = {
  id: 'x',
  dayKey: '2027-05-01',
  title: 'Colosseum',
  order: 0,
  duration: 'custom',
  durationHours: 2,
}

describe('Card', () => {
  it('renders the title', () => {
    render(<Card card={base} />)
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
  })

  it('shows the full timed span and a compact duration', () => {
    render(<Card card={{ ...base, startTime: '10:00', duration: 'custom', durationHours: 2 }} />)
    expect(screen.getByTestId('card-time')).toHaveTextContent('10:00 – 12:00 · 2h')
  })

  it('keeps card content visible while previewing a live start, end, and duration', () => {
    render(
      <Card
        card={{
          ...base,
          startTime: '10:00',
          note: 'Bring tickets',
          category: 'indoor',
          link: 'https://example.com',
        }}
        timingPreview={{ startTime: '10:15', durationHours: 1.75 }}
      />,
    )

    expect(screen.getByTestId('card')).toHaveClass('border-indoor-border', 'bg-indoor-bg/40')
    expect(screen.getByTestId('event-timing-start')).toHaveTextContent('10:15')
    expect(screen.getByTestId('event-timing-end')).toHaveTextContent('12:00')
    expect(screen.getByTestId('card-time')).toHaveTextContent('10:15 – 12:00 · 1h 45m')
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
    expect(screen.getByTestId('card-note')).toHaveTextContent('Bring tickets')
    expect(screen.getByTestId('card-category-icon')).toHaveAttribute('data-category', 'indoor')
    expect(screen.getByTestId('card-link')).toHaveTextContent('example.com')
  })

  it('collapses a short card to one line of glyph, name and time', () => {
    render(
      <Card
        card={{
          ...base,
          title: 'Brunch reservation',
          startTime: '10:00',
          note: 'Bring tickets',
          link: 'https://example.com',
          category: 'food',
          duration: 'custom',
          durationHours: 0.75,
        }}
      />,
    )
    const card = screen.getByTestId('card')
    expect(card).toHaveAttribute('data-short', '')
    // The time rides the title row; the note and link rows are dropped entirely
    // rather than clipped.
    expect(screen.getByTestId('card-title-row')).toContainElement(screen.getByTestId('card-time'))
    expect(screen.queryByTestId('card-note')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-link')).not.toBeInTheDocument()
    expect(screen.getByTestId('card-title')).toHaveClass('truncate')
  })

  it('renders category as a tint, left edge and inline type glyph — no chip', () => {
    render(<Card card={{ ...base, category: 'outdoor' }} conflict />)

    const header = screen.getByTestId('card-title-row')
    const glyph = screen.getByTestId('card-category-icon')
    expect(screen.getByTestId('card')).toHaveClass(
      'bg-category-outdoor-bg',
      'border-category-outdoor-edge',
      'border-l-category-outdoor',
    )
    // The glyph is inline, before the title — not a corner or a chip.
    expect(header).toContainElement(glyph)
    expect(header).toContainElement(screen.getByTestId('card-title'))
    expect(glyph).toHaveAttribute('data-category', 'outdoor')
    expect(screen.queryByTestId('card-category-corner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-category')).not.toBeInTheDocument()
    expect(screen.getByTestId('card-time').previousElementSibling).toBe(header)
    expect(screen.getByTestId('card-conflict')).toBeInTheDocument()
  })

  it('marks the three ticket states and washes a required-but-unbought card', () => {
    const { rerender } = render(<Card card={{ ...base, category: 'indoor' }} />)
    // Absent state reads as "no ticket needed" — the outline marker.
    expect(screen.getByTestId('card-ticket')).toHaveAttribute('data-ticket', 'none')
    expect(screen.getByTestId('card')).not.toHaveClass('bg-ticket-wash')

    rerender(<Card card={{ ...base, category: 'indoor', ticketState: 'bought' }} />)
    expect(screen.getByTestId('card-ticket')).toHaveAttribute('data-ticket', 'bought')
    expect(screen.getByTestId('card')).not.toHaveClass('bg-ticket-wash')

    rerender(<Card card={{ ...base, category: 'indoor', ticketState: 'required' }} />)
    expect(screen.getByTestId('card-ticket')).toHaveAttribute('data-ticket', 'required')
    // The wash sits over the tint but keeps the category's left edge.
    expect(screen.getByTestId('card')).toHaveClass(
      'bg-ticket-wash',
      'border-ticket-wash-edge',
      'border-l-category-indoor',
    )
  })

  it('never marks a transport card, whatever its ticket state', () => {
    render(<Card card={{ ...base, category: 'transit', ticketState: 'required' }} />)
    expect(screen.queryByTestId('card-ticket')).not.toBeInTheDocument()
    expect(screen.getByTestId('card')).not.toHaveClass('bg-ticket-wash')
  })

  it('uses the card surface as the drag activator without a separate handle', () => {
    render(
      <DndContext>
        <SortableCard card={{ ...base, startTime: '10:00' }} />
      </DndContext>,
    )
    expect(screen.queryByRole('button', { name: 'Drag Colosseum' })).not.toBeInTheDocument()
    expect(screen.getByTestId('card')).toHaveAttribute('role', 'button')
    expect(screen.getByTestId('card')).toHaveAttribute('tabindex', '0')
  })

  it('keeps the sortable item geometry while lightly tinting an active drag', () => {
    render(
      <DndContext>
        <SortableCard
          card={{
            ...base,
            startTime: '10:00',
            note: 'Bring tickets',
            category: 'indoor',
            link: 'https://example.com',
          }}
          conflict
          layoutStyle={{ height: 60, marginTop: 240 }}
        />
      </DndContext>,
    )

    const card = screen.getByTestId('card')
    card.focus()
    fireEvent.keyDown(card, { key: ' ', code: 'Space' })

    expect(screen.getByTestId('sortable-card')).toHaveStyle({
      height: '60px',
      marginTop: '240px',
    })
    expect(screen.getByTestId('card')).toHaveClass('border-indoor-border', 'bg-indoor-bg/40')
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
    expect(screen.getByTestId('card-note')).toHaveTextContent('Bring tickets')
    expect(screen.getByTestId('card-category-icon')).toHaveAttribute('data-category', 'indoor')
    expect(screen.getByTestId('card-link')).toHaveTextContent('example.com')
    expect(screen.queryByRole('button', { name: /Resize Colosseum/ })).not.toBeInTheDocument()
  })

  it('attaches pointer listeners to the card surface', () => {
    const onPointerDown = vi.fn()
    render(<Card card={base} dragSurfaceProps={{ onPointerDown }} />)
    fireEvent.pointerDown(screen.getByTestId('card'))
    expect(onPointerDown).toHaveBeenCalledOnce()
  })

  it('shows start and end resize handles only for timed cards', () => {
    const resizeHandleProps = { start: {}, end: {} }
    const { rerender } = render(
      <Card card={{ ...base, startTime: '10:00' }} resizeHandleProps={resizeHandleProps} />,
    )
    expect(screen.getByRole('button', { name: 'Resize Colosseum start' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resize Colosseum end' })).toBeInTheDocument()

    rerender(<Card card={base} resizeHandleProps={resizeHandleProps} />)
    expect(screen.queryByRole('button', { name: /Resize Colosseum/ })).not.toBeInTheDocument()
  })

  it('keeps full invisible resize targets', () => {
    render(
      <Card card={{ ...base, startTime: '10:00' }} resizeHandleProps={{ start: {}, end: {} }} />,
    )

    for (const edge of ['start', 'end']) {
      const handle = screen.getByRole('button', { name: `Resize Colosseum ${edge}` })
      expect(handle).toHaveClass('h-3', 'cursor-row-resize', 'focus-visible:ring-2')
      expect(handle.querySelector('span')).not.toBeInTheDocument()
    }
  })

  it('keeps links and resize handles from activating a card move', () => {
    const onPointerDown = vi.fn()
    render(
      <Card
        card={{ ...base, startTime: '10:00', link: 'https://example.com' }}
        dragSurfaceProps={{ onPointerDown }}
        resizeHandleProps={{ start: {}, end: {} }}
      />,
    )

    fireEvent.pointerDown(screen.getByTestId('card-link'))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Resize Colosseum start' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Resize Colosseum end' }))
    expect(onPointerDown).not.toHaveBeenCalled()
  })

  it('previews pointer resizing and uses the same controller for keyboard resizing', () => {
    const plan = vi.fn(
      (_cardId: string, _edge: string, deltaPx: number): CardResizePlan => ({
        startTime: deltaPx < 0 ? '09:45' : '10:00',
        duration: 'custom',
        durationHours: deltaPx === 0 ? 2 : 2.25,
        heightPx: deltaPx === 0 ? 120 : 135,
        topOffsetPx: deltaPx < 0 ? -15 : 0,
      }),
    )
    const commit = vi.fn()
    const controller: CardResizeController = { plan, commit }
    render(
      <CardResizeContext.Provider value={controller}>
        <DndContext>
          <SortableCard
            card={{
              ...base,
              startTime: '10:00',
              note: 'Bring tickets',
              category: 'indoor',
              link: 'https://example.com',
            }}
            conflict
            layoutStyle={{ height: 120, marginTop: 240 }}
          />
        </DndContext>
      </CardResizeContext.Provider>,
    )
    const start = screen.getByRole('button', { name: 'Resize Colosseum start' })
    const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', clientY: number) => {
      const event = createEvent[type](start)
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        clientY: { value: clientY },
      })
      fireEvent(start, event)
    }
    pointer('pointerDown', 100)
    expect(document.body).toHaveClass('cursor-row-resize')
    expect(screen.getByTestId('event-timing-start')).toHaveTextContent('10:00')
    expect(screen.getByTestId('event-timing-end')).toHaveTextContent('12:00')
    expect(screen.getByTestId('card-time')).toHaveTextContent('10:00 – 12:00 · 2h')
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
    expect(screen.getByTestId('card-note')).toHaveTextContent('Bring tickets')
    expect(screen.getByTestId('card-category-icon')).toHaveAttribute('data-category', 'indoor')
    expect(screen.getByTestId('card-link')).toHaveTextContent('example.com')
    expect(screen.getByTestId('card-conflict')).toHaveTextContent('Overlap')
    expect(screen.queryByRole('button', { name: /Resize Colosseum/ })).not.toBeInTheDocument()

    const pointerWindow = (
      type: 'pointerMove' | 'pointerUp' | 'pointerCancel',
      clientY: number,
    ) => {
      const event = new Event(type.toLowerCase())
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        clientY: { value: clientY },
      })
      fireEvent(window, event)
    }
    pointerWindow('pointerMove', 85)
    const sortable = screen.getByTestId('sortable-card')
    expect(sortable).toHaveStyle({ height: '135px' })
    expect(sortable.style.marginTop).toBe('225px')
    expect(screen.getByTestId('event-timing-start')).toHaveTextContent('09:45')
    expect(screen.getByTestId('event-timing-end')).toHaveTextContent('12:00')
    expect(screen.getByTestId('card-time')).toHaveTextContent('09:45 – 12:00 · 2h 15m')
    pointerWindow('pointerUp', 85)
    expect(document.body).not.toHaveClass('cursor-row-resize')
    // The pointer forwards its raw travel (100 → 85); only the keyboard steps
    // below are expressed in scale units.
    expect(commit).toHaveBeenCalledWith('x', 'start', -15)
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')

    const restoredStart = screen.getByRole('button', { name: 'Resize Colosseum start' })
    fireEvent.keyDown(restoredStart, { key: 'ArrowUp' })
    expect(commit).toHaveBeenCalledWith('x', 'start', -MIN_PX_PER_HOUR / 4)
    fireEvent.keyDown(restoredStart, { key: 'ArrowDown', shiftKey: true })
    expect(commit).toHaveBeenCalledWith('x', 'start', MIN_PX_PER_HOUR)
  })

  it('restores the original card and geometry after a cancelled resize without committing', () => {
    const plan = vi.fn(
      (_cardId: string, _edge: string, deltaPx: number): CardResizePlan => ({
        startTime: '10:00',
        duration: 'custom',
        durationHours: deltaPx === 0 ? 1 : 1.25,
        heightPx: deltaPx === 0 ? 60 : 75,
        topOffsetPx: 0,
      }),
    )
    const commit = vi.fn()
    render(
      <CardResizeContext.Provider value={{ plan, commit }}>
        <DndContext>
          <SortableCard
            card={{ ...base, startTime: '10:00' }}
            layoutStyle={{ height: 60, marginTop: 240 }}
          />
        </DndContext>
      </CardResizeContext.Provider>,
    )

    const handle = screen.getByRole('button', { name: 'Resize Colosseum end' })
    const down = createEvent.pointerDown(handle)
    Object.defineProperties(down, {
      pointerId: { value: 2 },
      clientY: { value: 100 },
    })
    fireEvent(handle, down)

    const move = new Event('pointermove')
    Object.defineProperties(move, {
      pointerId: { value: 2 },
      clientY: { value: 115 },
    })
    fireEvent(window, move)
    expect(screen.getByTestId('sortable-card')).toHaveStyle({ height: '75px' })

    const cancel = new Event('pointercancel')
    Object.defineProperty(cancel, 'pointerId', { value: 2 })
    fireEvent(window, cancel)

    expect(commit).not.toHaveBeenCalled()
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
    expect(screen.getByTestId('sortable-card')).toHaveStyle({
      height: '60px',
      marginTop: '240px',
    })
  })

  it('shows the duration for an untimed card', () => {
    render(<Card card={{ ...base, duration: 'custom', durationHours: 1.5 }} />)
    expect(screen.getByTestId('card-time')).toHaveTextContent('1h 30m')
  })

  it('shows the default duration when the card is untimed', () => {
    render(<Card card={{ ...base, duration: 'custom', durationHours: 1 }} />)
    expect(screen.getByTestId('card-time')).toHaveTextContent('1h')
  })

  it('renders an optional note', () => {
    render(<Card card={{ ...base, note: 'Bring tickets' }} />)
    expect(screen.getByTestId('card-note')).toHaveTextContent('Bring tickets')
  })

  it('renders an optional link as an anchor', () => {
    render(<Card card={{ ...base, link: 'https://example.com' }} />)
    const link = screen.getByTestId('card-link')
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('never renders a javascript: link as a clickable anchor', () => {
    render(<Card card={{ ...base, link: 'javascript:alert(document.cookie)' }} />)
    // No anchor at all, so the dangerous scheme can't be a clickable href.
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    const inert = screen.getByTestId('card-link')
    expect(inert.tagName).toBe('SPAN')
    expect(inert).not.toHaveAttribute('href')
  })

  it('omits note and link when absent', () => {
    render(<Card card={base} />)
    expect(screen.queryByTestId('card-note')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-link')).not.toBeInTheDocument()
  })

  it.each(['indoor', 'outdoor', 'food', 'transit'] as const)(
    'renders a %s type glyph reflecting the card category',
    (category) => {
      render(<Card card={{ ...base, category }} />)
      expect(screen.getByTestId('card-category-icon')).toHaveAttribute('data-category', category)
      expect(screen.getByTestId('card')).toHaveAttribute('data-category', category)
    },
  )

  it('shows the transit glyph for a legacy transport card', () => {
    render(<Card card={{ ...base, transport: true }} />)
    expect(screen.getByTestId('card-category-icon')).toHaveAttribute('data-category', 'transit')
    expect(screen.getByTestId('card')).toHaveAttribute('data-category', 'transit')
  })

  it('keeps an uncategorised card on the neutral surface, with no glyph', () => {
    render(<Card card={base} />)
    expect(screen.queryByTestId('card-category-icon')).not.toBeInTheDocument()
    expect(screen.getByTestId('card')).not.toHaveAttribute('data-category')
    expect(screen.getByTestId('card')).toHaveClass('bg-surface', 'border-edge-100')
  })

  it('calls onEdit with the card when clicked', () => {
    const onEdit = vi.fn()
    render(<Card card={base} onEdit={onEdit} />)
    fireEvent.click(screen.getByTestId('card'))
    expect(onEdit).toHaveBeenCalledWith(base)
  })
})
