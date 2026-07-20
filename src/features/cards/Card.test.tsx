import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { Card as CardType } from '../../data/schema'
import {
  CardResizeContext,
  type CardResizeController,
  type CardResizePlan,
} from '../board/cardResize'
import { Card, SortableCard } from './Card'

const base: CardType = {
  id: 'x',
  dayKey: '2027-05-01',
  title: 'Colosseum',
  order: 0,
  duration: 'custom',
  durationHours: 1,
}

describe('Card', () => {
  it('renders the title', () => {
    render(<Card card={base} />)
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
  })

  it('shows the start time and duration without an end time', () => {
    render(<Card card={{ ...base, startTime: '10:00', duration: 'custom', durationHours: 2 }} />)
    expect(screen.getByTestId('card-time')).toHaveTextContent('10:00 · 2h')
    expect(screen.getByTestId('card-time')).not.toHaveTextContent('–')
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
    expect(screen.getByTestId('card-time')).toHaveTextContent('10:15–12:00 · 1.75h')
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
    expect(screen.getByTestId('card-note')).toHaveTextContent('Bring tickets')
    expect(screen.getByTestId('card-category')).toHaveTextContent('indoor')
    expect(screen.getByTestId('card-link')).toHaveTextContent('example.com')
  })

  it('lets title and time use the full card width', () => {
    render(
      <Card
        card={{
          ...base,
          title: 'Brunch reservation',
          startTime: '10:00',
          duration: 'custom',
          durationHours: 1,
        }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Edit Brunch reservation' })).toHaveClass(
      'min-w-0',
      'flex-1',
      'flex-col',
    )
    expect(screen.getByTestId('card-title')).toHaveClass('min-w-0')
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
    expect(screen.getByTestId('card-category')).toHaveTextContent('indoor')
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

  it('keeps full resize targets while hiding their hairlines until hover or focus', () => {
    render(
      <Card card={{ ...base, startTime: '10:00' }} resizeHandleProps={{ start: {}, end: {} }} />,
    )

    for (const edge of ['start', 'end']) {
      const handle = screen.getByRole('button', { name: `Resize Colosseum ${edge}` })
      const hairline = handle.querySelector('span')
      expect(handle).toHaveClass('h-3', 'cursor-row-resize', 'focus-visible:ring-2', 'group')
      expect(hairline).toHaveClass(
        'h-px',
        'bg-transparent',
        'group-hover:bg-ink-300/40',
        'group-focus-visible:bg-ink-300/40',
      )
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
        durationHours: deltaPx === 0 ? 1 : 1.25,
        heightPx: deltaPx === 0 ? 60 : 75,
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
            direction="down"
            layoutStyle={{ height: 60, marginTop: 240 }}
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
    expect(screen.getByTestId('event-timing-start')).toHaveTextContent('10:00')
    expect(screen.getByTestId('event-timing-end')).toHaveTextContent('11:00')
    expect(screen.getByTestId('card-time')).toHaveTextContent('10:00–11:00 · 1h')
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
    expect(screen.getByTestId('card-note')).toHaveTextContent('Bring tickets')
    expect(screen.getByTestId('card-category')).toHaveTextContent('indoor')
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
    expect(sortable).toHaveStyle({ height: '75px' })
    expect(sortable.style.marginTop).toBe('225px')
    expect(screen.getByTestId('event-timing-start')).toHaveTextContent('09:45')
    expect(screen.getByTestId('event-timing-end')).toHaveTextContent('11:00')
    expect(screen.getByTestId('card-time')).toHaveTextContent('09:45–11:00 · 1.25h')
    pointerWindow('pointerUp', 85)
    expect(commit).toHaveBeenCalledWith('x', 'start', -15)
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')

    const restoredStart = screen.getByRole('button', { name: 'Resize Colosseum start' })
    fireEvent.keyDown(restoredStart, { key: 'ArrowUp' })
    expect(commit).toHaveBeenCalledWith('x', 'start', -15)
    fireEvent.keyDown(restoredStart, { key: 'ArrowDown', shiftKey: true })
    expect(commit).toHaveBeenCalledWith('x', 'start', 60)
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
    expect(screen.getByTestId('card-time')).toHaveTextContent('1.5h')
  })

  it('shows a duration when the card is untimed', () => {
    render(<Card card={base} />)
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

  it.each(['indoor', 'outdoor', 'transit'] as const)(
    'renders a %s category chip reflecting the card category',
    (category) => {
      render(<Card card={{ ...base, category }} />)
      const chip = screen.getByTestId('card-category')
      expect(chip).toHaveTextContent(category)
      expect(screen.getByTestId('card')).toHaveAttribute('data-category', category)
    },
  )

  it('shows the transit chip for a legacy transport card', () => {
    render(<Card card={{ ...base, transport: true }} />)
    const chip = screen.getByTestId('card-category')
    expect(chip).toHaveTextContent('transit')
    expect(screen.getByTestId('card')).toHaveAttribute('data-category', 'transit')
  })

  it('omits the category chip for an uncategorised card', () => {
    render(<Card card={base} />)
    expect(screen.queryByTestId('card-category')).not.toBeInTheDocument()
    expect(screen.getByTestId('card')).not.toHaveAttribute('data-category')
  })

  it('calls onEdit with the card when clicked', () => {
    const onEdit = vi.fn()
    render(<Card card={base} onEdit={onEdit} />)
    fireEvent.click(screen.getByTestId('card'))
    expect(onEdit).toHaveBeenCalledWith(base)
  })
})
