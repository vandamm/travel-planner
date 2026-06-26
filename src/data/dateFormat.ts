// European display formatting for dates and clock times. Stored values stay ISO
// (yyyy-MM-dd) / 24h (HH:mm); these render them for the EU audience: day-first
// dates and 24h time ranges. The single source of truth for *displayed* (not
// native-widget) date/time format. Pure + browser-free, alongside the other
// shared src/data helpers.
import { format, parseISO } from 'date-fns'

/** A stored day key (yyyy-MM-dd) → European day-first 'dd.MM'. */
export function formatDay(dayKey: string): string {
  return format(parseISO(dayKey), 'dd.MM')
}

/** A stored 'HH:mm' (already 24h); a range 'HH:mm–HH:mm' when an end is given. */
export function formatTimeRange(start: string, end?: string): string {
  return end ? `${start}–${end}` : start
}
