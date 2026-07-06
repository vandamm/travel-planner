import { createContext, useContext } from 'react'

/** The day key currently under the drag pointer, or null when idle. */
export const DragOverDayContext = createContext<string | null>(null)

/** Whether a card is being dragged over the given day column (drop hint). */
export function useIsDragOverDay(dayKey: string): boolean {
  return useContext(DragOverDayContext) === dayKey
}
