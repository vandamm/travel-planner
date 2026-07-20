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
      className="relative z-20 flex h-full min-h-[84px] flex-col justify-center rounded-card border border-manipulation-border bg-manipulation-bg px-3 font-sans text-manipulation-text shadow-none"
    >
      <div className="flex items-center gap-2 text-[22px] font-medium leading-none">
        <span data-testid="event-timing-start">{startTime ?? '—'}</span>
        <span aria-hidden className="text-manipulation-muted">
          →
        </span>
        <span data-testid="event-timing-end">{endTime ?? '—'}</span>
      </div>
      <span
        data-testid="event-timing-duration"
        className="mt-2 border-t border-manipulation-text/10 pt-2 text-center text-base font-medium text-manipulation-duration"
      >
        {formatDuration(durationMinutes)}
      </span>
    </article>
  )
}
