import { createContext, useContext } from 'react'
import type { Card } from '../../data/schema'

/** The day key currently under the drag pointer, or null when idle. */
export const DragOverDayContext = createContext<string | null>(null)

/** Whether a card is being dragged over the given day column (drop hint). */
export function useIsDragOverDay(dayKey: string): boolean {
  return useContext(DragOverDayContext) === dayKey
}

/** The visual-only card placement while a drag is active. */
export interface DragPreview {
  card: Card
  dayKey: string
  startTime: string | null
  durationHours: number
}

export const DragPreviewContext = createContext<DragPreview | null>(null)

export function useDragPreview(): DragPreview | null {
  return useContext(DragPreviewContext)
}
