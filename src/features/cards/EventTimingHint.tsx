import { clockMinutes, clockString } from './cardHeight'

export interface EventTimingHintProps {
  startTime: string | null
  durationHours: number
}

function formatDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ')
}

export function EventTimingHint({ startTime, durationHours }: EventTimingHintProps) {
  const durationMinutes = Math.round(durationHours * 60)
  const endTime = startTime ? clockString(clockMinutes(startTime) + durationMinutes) : null

  return (
    <article
      data-testid="event-timing-hint"
      className="relative z-20 flex h-full min-h-[84px] items-center justify-center rounded-card border border-indoor-border bg-indoor-bg px-3 font-sans shadow-none"
    >
      <span
        data-testid="event-timing-start"
        className="absolute left-1/2 -top-5 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium leading-none text-ink-600"
      >
        {startTime ?? '—'}
      </span>
      <span
        data-testid="event-timing-duration"
        className="text-center text-[11px] font-medium leading-none text-ink-600"
      >
        {formatDuration(durationMinutes)}
      </span>
      <span
        data-testid="event-timing-end"
        className="absolute left-1/2 -bottom-5 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium leading-none text-ink-600"
      >
        {endTime ?? '—'}
      </span>
    </article>
  )
}
