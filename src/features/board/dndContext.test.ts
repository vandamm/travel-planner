import { act, render, screen } from '@testing-library/react'
import { createElement, useContext } from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { addCard, getCard, setTrip } from '../../data/doc'
import { CardResizeContext, type CardResizeController } from './cardResize'
import { prioritizeCardCollisions } from './dndCollision'
import { BoardDnd } from './dndContext'
import { useDragPreview } from './dragOverDayContext'

const dndCallbacks = vi.hoisted(() => ({
  onDragStart: undefined as ((event: unknown) => void) | undefined,
  onDragMove: undefined as ((event: unknown) => void) | undefined,
  onDragOver: undefined as ((event: unknown) => void) | undefined,
  onDragEnd: undefined as ((event: unknown) => void) | undefined,
  onDragCancel: undefined as (() => void) | undefined,
}))

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: ({ children, ...callbacks }: { children: unknown; [key: string]: unknown }) => {
      Object.assign(dndCallbacks, callbacks)
      return children
    },
    DragOverlay: ({ children }: { children: unknown }) => children,
    useSensor: () => ({}),
    useSensors: (...sensors: unknown[]) => sensors,
  }
})

describe('prioritizeCardCollisions', () => {
  it('prefers a card target over the overlapping day body', () => {
    const day = { id: 'day:2027-05-01' }
    const card = { id: 'card-2' }

    expect(prioritizeCardCollisions([day, card])).toEqual([card])
  })

  it('keeps the day body as the target when there is no card below the pointer', () => {
    const day = { id: 'day:2027-05-01' }

    expect(prioritizeCardCollisions([day])).toEqual([day])
  })
})

describe('BoardDnd card resizing', () => {
  it('provides one planner and committer for pointer and keyboard resizing', () => {
    const doc = new Y.Doc()
    setTrip(doc, { dayStart: '06:00', dayEnd: '21:00' })
    addCard(doc, {
      id: 'active',
      dayKey: '2027-05-01',
      title: 'Museum',
      startTime: '10:00',
      duration: 'custom',
      durationHours: 1,
    })
    const onTimelineChange = vi.fn()
    let controller: CardResizeController | undefined

    function Probe() {
      controller = useContext(CardResizeContext)
      return null
    }

    render(
      createElement(BoardDnd, {
        doc,
        direction: 'down',
        dayStart: '06:00',
        dayEnd: '21:00',
        onTimelineChange,
        children: createElement(Probe),
      }),
    )

    expect(controller?.plan('active', 'end', 15)).toMatchObject({ durationHours: 1.25 })
    act(() => controller?.commit('active', 'end', 15))
    expect(getCard(doc, 'active')).toMatchObject({ durationHours: 1.25 })
    expect(onTimelineChange).toHaveBeenCalledOnce()
  })
})

describe('BoardDnd drag timing preview', () => {
  function PreviewProbe() {
    const preview = useDragPreview()
    return preview
      ? createElement(
          'output',
          { 'data-testid': 'drag-preview-state' },
          `${preview.dayKey} ${preview.startTime} ${preview.durationHours}`,
        )
      : null
  }

  function dayBody(dayKey: string) {
    return createElement(
      'section',
      { 'data-day': dayKey },
      createElement('div', {
        'data-testid': 'day-body',
        ref: (node: HTMLDivElement | null) => {
          if (!node) return
          Object.defineProperty(node, 'scrollTop', { value: 0, configurable: true })
          node.getBoundingClientRect = () =>
            ({
              top: 100,
              left: 0,
              right: 300,
              bottom: 1000,
              width: 300,
              height: 900,
              x: 0,
              y: 100,
              toJSON() {},
            }) as DOMRect
        },
      }),
    )
  }

  function dragEvent(activeId: string, translatedTop: number, dayKey: string) {
    return {
      active: {
        id: activeId,
        rect: { current: { initial: { top: 220 }, translated: { top: translatedTop } } },
      },
      over: { id: `day:${dayKey}` },
      delta: { x: 0, y: translatedTop - 220 },
    }
  }

  it('starts with current timing, updates on move, and commits that preview', () => {
    const doc = new Y.Doc()
    const dayKey = '2027-05-01'
    const active = addCard(doc, {
      id: 'active',
      dayKey,
      title: 'Museum',
      startTime: '10:00',
      duration: 'custom',
      durationHours: 1,
    }).id
    const neighbor = addCard(doc, {
      id: 'neighbor',
      dayKey,
      title: 'Lunch',
      startTime: '10:15',
      duration: 'custom',
      durationHours: 1,
    }).id

    render(
      createElement(BoardDnd, {
        doc,
        direction: 'down',
        children: createElement('div', null, dayBody(dayKey), createElement(PreviewProbe)),
      }),
    )

    act(() => dndCallbacks.onDragStart?.(dragEvent(active, 220, dayKey)))
    expect(screen.getByTestId('drag-preview-state')).toHaveTextContent(`${dayKey} 10:00 1`)

    act(() => dndCallbacks.onDragMove?.(dragEvent(active, 355, dayKey)))
    expect(screen.getByTestId('drag-preview-state')).toHaveTextContent(`${dayKey} 10:15 1`)

    act(() => dndCallbacks.onDragEnd?.(dragEvent(active, 355, dayKey)))
    expect(getCard(doc, active)?.startTime).toBe('10:15')
    expect(getCard(doc, neighbor)?.startTime).toBe('10:15')
    expect(screen.queryByTestId('drag-preview-state')).not.toBeInTheDocument()
  })

  it('starts untimed with dashes, previews over a day, and cancels without a write', () => {
    const doc = new Y.Doc()
    const dayKey = '2027-05-01'
    const active = addCard(doc, {
      id: 'active',
      dayKey,
      title: 'Stroll',
      duration: 'custom',
      durationHours: 1,
    }).id
    let updates = 0
    doc.on('update', () => (updates += 1))

    render(
      createElement(BoardDnd, {
        doc,
        direction: 'down',
        children: createElement('div', null, dayBody(dayKey), createElement(PreviewProbe)),
      }),
    )

    act(() => dndCallbacks.onDragStart?.(dragEvent(active, 220, dayKey)))
    expect(screen.getByTestId('drag-preview-state')).toHaveTextContent(`${dayKey} null 1`)

    act(() => dndCallbacks.onDragMove?.(dragEvent(active, 355, dayKey)))
    expect(screen.getByTestId('drag-preview-state')).toHaveTextContent(`${dayKey} 10:15 1`)

    act(() => dndCallbacks.onDragCancel?.())
    expect(getCard(doc, active)?.startTime).toBeUndefined()
    expect(updates).toBe(0)
    expect(screen.queryByTestId('drag-preview-state')).not.toBeInTheDocument()
  })

  it('moves the in-column preview to the day beneath the pointer', () => {
    const doc = new Y.Doc()
    const dayKey = '2027-05-01'
    const targetDayKey = '2027-05-02'
    const active = addCard(doc, {
      id: 'active',
      dayKey,
      title: 'Museum',
      startTime: '10:00',
      duration: 'custom',
      durationHours: 1,
    }).id

    render(
      createElement(BoardDnd, {
        doc,
        direction: 'down',
        children: createElement(
          'div',
          null,
          dayBody(dayKey),
          dayBody(targetDayKey),
          createElement(PreviewProbe),
        ),
      }),
    )

    act(() => dndCallbacks.onDragStart?.(dragEvent(active, 220, dayKey)))
    act(() => dndCallbacks.onDragMove?.(dragEvent(active, 355, targetDayKey)))

    expect(screen.getByTestId('drag-preview-state')).toHaveTextContent(`${targetDayKey} 10:15 1`)
    expect(getCard(doc, active)?.dayKey).toBe(dayKey)
  })

  it('does not commit a cached preview when released outside every drop target', () => {
    const doc = new Y.Doc()
    const dayKey = '2027-05-01'
    const active = addCard(doc, {
      id: 'active',
      dayKey,
      title: 'Museum',
      startTime: '10:00',
      duration: 'custom',
      durationHours: 1,
    }).id
    let updates = 0
    doc.on('update', () => (updates += 1))

    render(
      createElement(BoardDnd, {
        doc,
        direction: 'down',
        children: dayBody(dayKey),
      }),
    )

    act(() => dndCallbacks.onDragStart?.(dragEvent(active, 220, dayKey)))
    act(() => dndCallbacks.onDragMove?.(dragEvent(active, 355, dayKey)))
    act(() =>
      dndCallbacks.onDragEnd?.({
        ...dragEvent(active, 355, dayKey),
        over: null,
      }),
    )

    expect(getCard(doc, active)?.startTime).toBe('10:00')
    expect(updates).toBe(0)
  })
})
