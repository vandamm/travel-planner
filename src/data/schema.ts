// Environment-agnostic domain types for the trip board.
//
// These describe the *plain JS* shape of every entity. The Yjs document
// (see `doc.ts`) stores each entity as a nested `Y.Map` whose `toJSON()` yields
// exactly these objects, and the same types back the zod import/export schema
// and the Worker agent API — so the client and Worker never drift.
//
// Calendar dates are ISO-8601 *date-only* strings ('YYYY-MM-DD'); clock times
// are 'HH:mm' (24-hour, local to the trip — no timezone is modelled).

/** A trip's top-level settings. */
export interface Trip {
  title: string
  /** First day of the trip, 'YYYY-MM-DD'. */
  startDate: string
  /** Last day of the trip, inclusive, 'YYYY-MM-DD'. */
  endDate: string
  /** Start of each day's timeline window, 'HH:mm' (default '06:00'). */
  dayStart: string
  /** End of each day's timeline window, 'HH:mm' (default '21:00'). */
  dayEnd: string
}

/** A city with a display color; cities color-code the days they cover. */
export interface City {
  id: string
  name: string
  /** Any CSS color, e.g. '#ef4444'. */
  color: string
}

/**
 * A resolved day on the board. Derived from the trip + accommodations +
 * overrides (see `cityResolution.ts`) — never stored directly in the doc.
 */
export interface Day {
  /** Calendar date 'YYYY-MM-DD'; also the column / card `dayKey` identity. */
  key: string
  /** 0-based offset from the trip start date. */
  index: number
  /** Resolved city for the day, if any (a manual override or covering stay). */
  cityId?: string
}

/**
 * Card height preset. `auto` (the default / absent) sizes the card by its
 * duration (end−start, or a 1-hour block); the presets override that with a
 * fixed height relative to the day's timeline window (see `cardHeight.ts`).
 */
export type CardSize = 'auto' | 'small' | 'half' | 'full'

/** Activity category — drives the card's colour chip. */
export type CardCategory = 'indoor' | 'outdoor' | 'transit'

/** An activity card living in a single day column. */
export interface Card {
  id: string
  /** Calendar date of the day column this card belongs to. */
  dayKey: string
  title: string
  note?: string
  link?: string
  /** Clock time 'HH:mm'; its presence makes the card time-bound (auto-sorted). */
  startTime?: string
  endTime?: string
  /** Manual position among untimed cards in a day (timed cards sort by time). */
  order: number
  color?: string
  icon?: string
  /**
   * Legacy transportation-leg flag. Kept valid for back-compat with older
   * synced docs; `category` supersedes it and `cardCategory()` derives
   * `transport: true` as `'transit'` at read time.
   */
  transport?: boolean
  /** Activity category (see `cardCategory`); absent = uncategorised. */
  category?: CardCategory
  /** Height preset; absent = `auto` (height from duration). */
  size?: CardSize
}

/**
 * Accommodation spanning one or more nights. The covered days inherit its
 * city's color unless a per-day override wins (hybrid resolution).
 */
export interface Accommodation {
  id: string
  label: string
  /** City whose color the covered days inherit. */
  cityId?: string
  /** First night (check-in), 'YYYY-MM-DD'. */
  startNight: string
  /** Last night slept, 'YYYY-MM-DD' (checkout is the following morning). */
  endNight: string
}
