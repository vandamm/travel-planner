// Pure helpers for the §11 time picker: the wheel's value lists (hours 00–23,
// minutes 00–59), 24h 'HH:mm' parse/format, and a clamp-to-nearest-valid snap so
// a stored value can never round-trip out of range. DOM-free and unit-tested;
// the TimePicker UI renders the two columns on top of these. Values stay 24h
// 'HH:mm' in and out — the same invariant the native input followed.

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Hour column labels, '00'–'23' (index === the hour). */
export const HOURS: string[] = Array.from({ length: 24 }, (_, h) => pad2(h))
/** Minute column labels, '00'–'59' (index === the minute). */
export const MINUTES: string[] = Array.from({ length: 60 }, (_, m) => pad2(m))

export interface TimeParts {
  hour: number
  minute: number
}

/** Parse a stored 'HH:mm' (24h) into parts, or null when empty/malformed. */
export function parseTime(value: string | undefined): TimeParts | null {
  const m = value?.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

/** Snap arbitrary parts to the nearest valid wheel cell (hour 0–23, min 0–59). */
export function snapTime(parts: TimeParts): TimeParts {
  return { hour: clamp(parts.hour, 0, 23), minute: clamp(parts.minute, 0, 59) }
}

/** Format parts back to 'HH:mm', snapping into range first so output is valid. */
export function formatTime(parts: TimeParts): string {
  const { hour, minute } = snapTime(parts)
  return `${pad2(hour)}:${pad2(minute)}`
}
