// React hook over the per-user time-direction preference. It seeds its initial
// value from localStorage and persists every change, so each person's choice
// survives a reload while staying out of the synced doc.

import { useCallback, useState } from 'react'
import {
  type TimeDirection,
  loadTimeDirection,
  saveTimeDirection,
  toggleDirection,
} from './timeDirection'

export interface UseTimeDirection {
  direction: TimeDirection
  /** Flip to the opposite direction (and persist it). */
  toggle: () => void
  /** Set an explicit direction (and persist it). */
  setDirection: (direction: TimeDirection) => void
}

export function useTimeDirection(): UseTimeDirection {
  const [direction, setDirectionState] = useState<TimeDirection>(() => loadTimeDirection())

  const setDirection = useCallback((next: TimeDirection) => {
    setDirectionState(next)
    saveTimeDirection(next)
  }, [])

  const toggle = useCallback(() => {
    setDirectionState((prev) => {
      const next = toggleDirection(prev)
      saveTimeDirection(next)
      return next
    })
  }, [])

  return { direction, toggle, setDirection }
}
