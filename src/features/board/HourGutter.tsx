// The one shared hour gutter down the left of the board (v4 replaces v3's
// per-column numerals in the inter-column gap).
//
// It shows a clock label every two hours at its true offset on the day window,
// plus the red "now" pill when today is on screen. It is a flex column whose
// label box is pushed to the bottom by a `flex-1` spacer: because every day
// column is header-above-body with the same body height, that makes the labels
// line up with the timeline tracks without measuring anything.

import {
  clockMinutes,
  evenHourMarks,
  hourMarkAlignment,
  windowHeightPx,
} from '../cards/cardHeight'
import { usePxPerHour } from './timelineScale'

export interface HourGutterProps {
  dayStart: string
  dayEnd: string
  /** Offset (px) of the now-line on the window, when today is visible. */
  nowOffsetPx?: number
  /** 'HH:mm' shown in the now pill. */
  nowClock?: string
  /** Gutter width; the mobile single-day rail is narrower. */
  widthPx: number
  /** Mobile trims the label to fit the narrower rail. */
  compact?: boolean
}

export function HourGutter({
  dayStart,
  dayEnd,
  nowOffsetPx,
  nowClock,
  widthPx,
  compact = false,
}: HourGutterProps) {
  const pxPerHour = usePxPerHour()
  const start = clockMinutes(dayStart)
  const hours = evenHourMarks(dayStart, dayEnd)
  const trackHeight = windowHeightPx(dayStart, dayEnd, pxPerHour)

  /** Keep the first and last labels inside the track rather than astride it. */
  const shift = (offsetPx: number) =>
    ({ start: '', center: '-translate-y-1/2', end: '-translate-y-full' })[
      hourMarkAlignment(offsetPx, trackHeight)
    ]

  return (
    <div
      data-testid="hour-gutter"
      aria-hidden
      style={{ width: widthPx, flex: `0 0 ${widthPx}px` }}
      className="sticky left-0 z-30 flex flex-col bg-white"
    >
      <div className="flex-1" />
      <div
        style={{ height: trackHeight }}
        className="relative"
      >
        {hours.map((hour) => {
          const offsetPx = ((hour * 60 - start) / 60) * pxPerHour
          return (
            <span
              key={hour}
              data-testid="hour-mark"
              data-hour={hour}
              style={{ top: offsetPx }}
              className={`absolute font-sans font-semibold leading-none text-hour-text ${shift(offsetPx)} ${compact ? 'right-2 text-[9.5px]' : 'right-2.5 text-[10px]'}`}
            >
              {String(hour).padStart(2, '0')}:00
            </span>
          )
        })}
        {nowOffsetPx !== undefined && nowClock && (
          <span
            data-testid="now-pill"
            style={{ top: nowOffsetPx }}
            className={`absolute right-1 ${shift(nowOffsetPx)} rounded-chip bg-city-vermilion px-[5px] py-[2px] font-sans text-[9.5px] font-extrabold leading-none text-white`}
          >
            {nowClock}
          </span>
        )}
      </div>
    </div>
  )
}
