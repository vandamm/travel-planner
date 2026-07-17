import { act, render } from '@testing-library/react'
import { createElement, useContext } from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { addCard, getCard, setTrip } from '../../data/doc'
import { CardResizeContext, type CardResizeController } from './cardResize'
import { prioritizeCardCollisions } from './dndCollision'
import { BoardDnd } from './dndContext'

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
      createElement(
        BoardDnd,
        {
          doc,
          direction: 'down',
          dayStart: '06:00',
          dayEnd: '21:00',
          onTimelineChange,
          children: createElement(Probe),
        },
      ),
    )

    expect(controller?.plan('active', 'end', 15)).toMatchObject({ durationHours: 1.25 })
    act(() => controller?.commit('active', 'end', 15))
    expect(getCard(doc, 'active')).toMatchObject({ durationHours: 1.25 })
    expect(onTimelineChange).toHaveBeenCalledOnce()
  })
})
