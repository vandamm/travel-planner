import { closestCenter, pointerWithin, type CollisionDetection } from '@dnd-kit/core'
import { isDayDroppableId } from './dndHandlers'

/** Prefer a card's insertion zone over the day body that sits beneath it. */
export function prioritizeCardCollisions<T extends { id: string | number }>(collisions: T[]): T[] {
  const cards = collisions.filter((collision) => !isDayDroppableId(String(collision.id)))
  return cards.length ? cards : collisions
}

export const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = prioritizeCardCollisions(pointerWithin(args))
  return pointerCollisions.length ? pointerCollisions : closestCenter(args)
}
