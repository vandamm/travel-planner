// The board's live vertical scale.
//
// `MIN_PX_PER_HOUR` is a floor, not the scale: the day stretches to fill
// whatever height the board has, so an hour is worth more pixels on a tall
// screen and the columns reach the bottom of the page. Everything that converts
// between minutes and pixels takes the value as an argument; components read it
// from this context rather than threading it through every prop.

import { createContext, useContext, useEffect, useState, type RefObject } from 'react'
import { MIN_PX_PER_HOUR, fitPxPerHour } from '../cards/cardHeight'

export const TimelineScaleContext = createContext(MIN_PX_PER_HOUR)

/** The scale the surrounding board settled on, or the floor outside one. */
export function usePxPerHour(): number {
  return useContext(TimelineScaleContext)
}

/**
 * Measure `containerRef` and derive the scale that makes one day fill it.
 *
 * The measurement is not circular: it subtracts the day body's *offset* inside
 * the container — the stays lane and day header above it, whose heights do not
 * depend on the scale — so growing the timeline can never feed back into the
 * number that sized it.
 */
export function useFittedPxPerHour(
  containerRef: RefObject<HTMLElement | null>,
  windowHours: number,
): number {
  const [pxPerHour, setPxPerHour] = useState(MIN_PX_PER_HOUR)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const body = container.querySelector('[data-testid="day-body"]')
      // Distance from the container's own top to where the timeline starts,
      // in content coordinates (so a scrolled board still measures the same).
      const offset = body
        ? body.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop
        : 0
      const next = fitPxPerHour(container.clientHeight - offset, windowHours)
      setPxPerHour((previous) => (previous === next ? previous : next))
    }

    measure()
    // jsdom has no ResizeObserver; the initial measure is enough there.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, windowHours])

  return pxPerHour
}
