# Timeline home implementation handoff

## Where to work

- Worktree: `/Users/O.Vansach/Development/travel-planner/.worktrees/timeline-home-prototypes`
- Branch: `codex/timeline-home-prototypes`
- The prototype directory is currently untracked. Preserve it before switching worktrees or branches.

## Visual source of truth

- `route-ledger.html` — approved default timeline view
- `year-calendar.html` — approved alternative calendar view
- `shared.css` — layout, palette, typography, breakpoints, and trip colours
- `shared.js` — rail-hover add button and accessible weekday labels
- `check.mjs` — static regression checks

Run the prototypes with `npm run dev -- --host 127.0.0.1`, then open:

- `http://127.0.0.1:5173/prototypes/timeline-home/route-ledger.html`
- `http://127.0.0.1:5173/prototypes/timeline-home/year-calendar.html`

The HTML contains illustrative trips, dates, and spacing. Copy the design and behavior, not the hard-coded data.

## Product decisions

- `/` opens the timeline by default. The calendar remains available through the header switch. Prefer `/?view=calendar` for a linkable alternative without adding a router.
- Use `Your travel timeline` on the timeline and `Your travel calendar` on the calendar. Do not add a calendar kicker such as `The whole year`.
- Keep the header on one row at every width. At 620px, hide the brand copy but retain the red seal. Show `+ Trip`; below 360px, show only `+` with the accessible name `New trip`.
- Keep the timeline rail centered at every width. Never move it to a fixed mobile offset. Phones reduce padding and type size only.
- Today is a red dot at the rail's top. Do not draw a red line. End the rail with an arrow.
- Put all countdowns, month labels, today, and holiday dates left of the rail. Put trip titles and date ranges right of it.
- Centre each trip title vertically against its pill. Pill height represents inclusive trip duration. Do not put text inside a short pill.
- Show countdowns as `in 15 days`, `in 4 weeks`, or `in 3 months`. Do not show open-time labels.
- Show month starts with short ticks that touch the rail. Hide a month marker when its boundary falls inside a trip. When a month starts inside a school-holiday band, show the month label and a short embedded tick within that band.
- Always show school holidays. Display dates only, such as `3 Aug. – 14 Sep.`; omit holiday names and label backgrounds. Bands occupy the left half and stop at the rail.
- The calendar uses at most three month columns. Weekday initials need full accessible labels.

## Data and layout rules

- Sort future trips by start date. Exclude undated and finished trips from the upcoming timeline.
- Persist one `color` on each trip. Assign it randomly from the approved palette when the trip is created, allow editing later, and use the same value in timeline, calendar, and trip lists. Never derive colour from array position.
- Palette: vermilion `#c0392b`, pine `#5f6f44`, indigo `#3a4a5c`, plum `#8a5a78`.
- A simple production scale is sufficient: `tripHeight = max(44, durationDays * 12)` pixels and `gapHeight = clamp(48, emptyDays * 4, 180)` pixels. Position month boundaries proportionally within each compressed gap.
- Both header and rail `+` controls open the same creation flow. The rail control prefills the date represented by its hover position.
- Show the rail `+` only for hover-capable pointers, only near the rail, not over a trip pill, and not within 24px of either endpoint. Keep it keyboard accessible through the normal header action.

## Existing code to reuse

- `src/features/home/YearCalendarHome.tsx` already loads every `/api/rooms` page, loads Bavaria school holidays, handles loading and retry states, and creates rooms. Reuse that logic instead of duplicating it.
- `src/features/home/yearCalendar.ts` already builds Monday-first month grids, finds trips and holidays on a day, and computes ribbon edges.
- `src/App.tsx` already sends `/` to `YearCalendarHome`. Replace that entry with the two-view home shell.
- `worker/src/rooms.ts` already returns room summaries. Once trip colour is stored, include it in these summaries through `getTrip`.
- Reuse the existing Tailwind tokens in `tailwind.config.js`; they match the prototype palette and Lora/Manrope typography.

Prefer editing `YearCalendarHome.tsx` and adding only the timeline component and pure timeline-layout helpers. Extract a shared header or loader only when both views need the same code.

## Schema coordination

The current branch still uses `numDays`. A separate approved breaking migration replaces it with inclusive `startDate` and `endDate`. Implement new homepage date math against that final shape, or isolate temporary conversion in one helper. Do not spread new `numDays` assumptions through the homepage.

## Acceptance checks

- Timeline is the default; Calendar is linkable and selectable.
- Header fits at 320px without wrapping or horizontal overflow.
- Rail remains centered at 320px, 375px, 620px, and desktop widths; labels stay attached to it.
- Trip pill height changes with duration.
- Large empty periods remain visible but compressed.
- Trip colour survives reload and matches in every view.
- Holidays remain visible, date-only, and correctly handle embedded month boundaries.
- Hover add button follows the rail and disappears over trips and near rail endpoints.
- Existing loading, retry, empty, keyboard-focus, and reduced-motion behavior still works.
- Add focused unit tests for date-to-height mapping, countdown units, month-boundary suppression, persistent colours, and view selection. Keep the existing calendar helper tests.

Verify with:

```sh
node prototypes/timeline-home/check.mjs
npm test
npm run build
```
