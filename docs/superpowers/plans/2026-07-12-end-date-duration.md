# End Date and Activity Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace trip duration and activity end times with end dates and explicit durations, while widening and reflowing the board.

**Architecture:** `startDate` and `endDate` become the only trip bounds. Cards hold a duration mode plus custom hours when needed; rendering resolves day-relative modes from the configured day window. Shared pure helpers keep date, duration, board geometry, and calendar behavior aligned.

**Tech Stack:** React 18, TypeScript, date-fns, Zod, Yjs, Vitest, Testing Library.

## Global Constraints

- This change is deliberately backwards-incompatible: remove `numDays`, `endTime`, and `size` completely.
- Phone view begins below 768px; day columns are 17rem wide.
- Day and half-day durations use `dayStart` and `dayEnd`.
- Custom duration is required and positive.
- Do not implement coordinate-based drops or vertical resizing.

---

### Task 1: Replace trip duration with an inclusive end date

**Files:** `src/data/schema.ts`, `src/data/days.ts`, `src/data/doc.ts`, `src/data/tripSchema.ts`, `src/data/applyTrip.ts`, `src/data/exportTrip.ts`, `src/data/*.{test.ts,tsx}`, `worker/src/*.test.ts`, `src/features/home/{yearCalendar.ts,YearCalendarHome.tsx}`, `src/App.tsx`, `src/features/{board/Board.tsx,trip/TripModal.tsx}`.

- [ ] Write failing tests that `generateDays('2027-05-01', '2027-05-03')` returns three inclusive days, blank/reversed ranges return no days, and the schema rejects a populated reversed range.
- [ ] Run `npm test -- src/data/days.test.ts src/data/tripSchema.test.ts` and confirm RED.
- [ ] Replace `numDays` with `endDate` in the Trip type, defaults, document mutators, Zod schema, import/export, Worker summaries, and all consumers. Add one shared inclusive-day-count helper; clamp generated ranges to 730 days.
- [ ] Replace the Trip modal number input with an end-date picker. Use the shared count in the header and home calendar.
- [ ] Run the targeted tests and confirm GREEN.

### Task 2: Replace card size and end time with duration

**Files:** `src/data/schema.ts`, `src/data/doc.ts`, `src/data/tripSchema.ts`, `src/features/cards/{cardHeight.ts,Card.tsx,CardEditor.tsx}`, `src/features/board/DayColumn.tsx`, `src/features/board/dndHandlers.ts`, related tests, `docs/trip-schema.md`.

- [ ] Write failing tests for `day`, `half`, and custom-height calculations; require a positive custom-hour value in JSON; assert card labels render `10:00 · 2h` and no end time.
- [ ] Run `npm test -- src/features/cards/cardHeight.test.ts src/features/cards/Card.test.tsx src/data/tripSchema.test.ts` and confirm RED.
- [ ] Replace `CardSize`, `size`, and `endTime` with `duration: 'day' | 'half' | 'custom'` and `durationHours` for custom cards. New cards default to custom one hour.
- [ ] Make the editor expose Day, Half day, and Custom. Show a required numeric hours input only for Custom. Keep start time optional, remove end time, and update card layout, overlap math, and drag timing to use resolved durations.
- [ ] Update the JSON schema documentation and run targeted tests to confirm GREEN.

### Task 3: Reflow responsive board and header

**Files:** `src/features/board/{useViewport.ts,DayColumn.tsx,multiWeekNav.ts}`, `src/features/accommodation/AccommodationLane.tsx`, `src/App.tsx`, and viewport/App tests.

- [ ] Write failing tests for a 768px desktop breakpoint and 272px column geometry.
- [ ] Run `npm test -- src/features/board/useViewport.test.tsx src/App.test.tsx` and confirm RED.
- [ ] Change the breakpoint to 768px, centralize the 272px/17rem geometry, and use it in the board, accommodation lane, fit calculation, and scroll stride. Make the trip header full width with the board's horizontal inset.
- [ ] Run targeted tests and confirm GREEN.

### Task 4: Full verification

**Files:** all touched source/docs and their tests.

- [ ] Run `npm test`, `npm run lint`, `npm run build`, `git diff --check`, and `npm run test:e2e`.
- [ ] Inspect the 768px and desktop layouts locally; confirm no tablet-only layout remains and the header aligns with the board.
- [ ] Commit the completed feature with `git add -A` and `git commit -m "feat: use trip end dates and activity durations"`.
