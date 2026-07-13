import { describe, expect, it } from 'vitest'
import { prioritizeCardCollisions } from './dndCollision'

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
