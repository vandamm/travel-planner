# Fix issues from implementation review

## Overview

Address 13 review findings on the travel-planner board: a configurable,
time-proportional day timeline (Minimal approach — keep the vertical sortable
list, stretch columns to the day window, scale cards by duration, surface empty
time), date/time localization (dd.mm.yyyy + 24h), weekend highlighting,
transportation cards, an agent-facing schema endpoint, removal of the on-page
import/export, a drag overlay that survives crossing days, and a half-width
split for two stays sharing a day.

## Context

- Board/timeline: `src/features/board/Board.tsx`, `DayColumn.tsx`,
  `MobileDayView.tsx`, `useViewport.ts`, `timeDirection.ts`, `dndContext.tsx`,
  `dndHandlers.ts`
- Cards: `src/features/cards/Card.tsx`, `CardEditor.tsx`, `cardSort.ts`
- Accommodation: `src/features/accommodation/AccommodationLane.tsx`,
  `accommodationSpan.ts`, `AccommodationBar.tsx`
- Shared data (client + Worker): `src/data/schema.ts`, `doc.ts`,
  `tripSchema.ts`, `exportTrip.ts`, `applyTrip.ts`
- Trip settings: `src/features/trip/TripSettings.tsx`; root: `src/App.tsx`,
  `index.html`
- Worker: `worker/src/index.ts`, `trip.ts`
- Docs: `docs/trip-schema.md`, `README.md`, `CLAUDE.md`

## Interpretation of ambiguous issues

- Issue 7 ("two stays same day"): two accommodations that cover the same day
  column are drawn on one row split left/right (earlier stay = left half, later
  = right half) instead of stacked on two rows. 3+ overlaps fall back to the
  current row stacking.
- Issue 1 ("show more when horizontal space"): the narrow/mobile pager
  currently shows exactly one day even when 2–3 columns would fit; it will
  instead render as many `w-56` columns as fit the viewport and page by that
  count. The wide desktop board already scrolls through all days, so it is
  unchanged.

## Development Approach

- **Testing approach**: TDD (red-green) for `src/data/` and pure logic per
  CLAUDE.md; Playwright e2e for UI behavior (drag, timeline), Vitest component
  tests where they already exist.
- Day window default 06:00–21:00, stored on the synced doc (configurable). Card
  height scales by duration (end−start; timed-without-end defaults to 1h;
  untimed gets a default block). Empty time shows as leftover space below the
  cards.
- Complete each task fully (tests green) before the next.
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Implementation Steps

### Task 1: Data foundation — day window + transport flag (shared schema)

**Files:**
- Modify: `src/data/schema.ts`, `src/data/doc.ts`, `src/data/tripSchema.ts`

- [x] Add `dayStart`/`dayEnd` (`HH:mm`) to `Trip` (schema.ts), defaulting to
  `'06:00'`/`'21:00'` in `DEFAULT_TRIP` and `getTrip`; handle them in `setTrip`.
- [x] Add optional `transport?: boolean` to `Card` (schema.ts) and to
  `NewCard`/`addCard` spread (doc.ts).
- [x] Extend `tripSettingsSchema` (dayStart/dayEnd as `clockTime`, optional with
  defaults) and `cardSchema` (`transport: z.boolean().optional()`) in
  tripSchema.ts.
- [x] Update/extend tests: `doc.test.ts`, `tripSchema.test.ts`, and
  `exportTrip.test.ts` round-trip for the new fields.
- [x] run `npm test` — must pass before Task 2.

### Task 2: Localization — dd.mm.yyyy dates + 24h times (issues 6, 12)

**Files:**
- Modify: `index.html` or the date/time inputs in `TripSettings.tsx`,
  `AccommodationEditor.tsx`, `CardEditor.tsx`; `DayColumn.tsx`

- [x] Add `lang="de"` to native `<input type="date">`/`<input type="time">`
  elements (value stays ISO/`HH:mm`, so data is unambiguous regardless of
  browser; ponytail: picker format is browser-dependent — note in code).
- [x] Change DayColumn date label to a day-first format (e.g. `EEE, dd.MM`);
  card times already render `HH:mm`.
- [x] Update DayColumn test to assert the day-first label.
- [x] run `npm test` — must pass before Task 3.

### Task 3: Remove on-page import/export (issue 10)

**Files:**
- Delete: `src/features/io/ImportExport.tsx`, `ImportExport.test.tsx`
- Modify: `src/App.tsx`

- [x] Remove `<ImportExport>` and its import from App.tsx (keep
  `applyTrip`/`exportTrip` — used by the Worker).
- [x] Update `App.test.tsx` to drop import/export expectations.
- [x] run `npm test` — must pass before Task 4.

### Task 4: Agent schema endpoint (issue 11)

**Files:**
- Modify: `worker/src/index.ts`, `worker/src/trip.ts`
- Dependency: add `zod-to-json-schema`

- [x] Add `GET /api/schema` returning the JSON Schema derived from
  `tripDocumentSchema` (single source of truth — no hand-written duplicate),
  owner-gated like the other agent routes.
- [x] Include a `$schema` pointer in the `GET /api/trip/:room` response so an
  agent reading an empty trip still learns the shape.
- [x] Add/extend Worker tests (`index.test.ts`/`trip.test.ts`) for the schema
  route and the `$schema` field.
- [x] run `npm test` — must pass before Task 5.

### Task 5: Configurable day window + timeline rendering + weekend highlight (issues 2, 3, 4, 5, 9)

**Files:**
- Modify: `src/features/trip/TripSettings.tsx`, `src/features/board/Board.tsx`,
  `DayColumn.tsx`; possibly `timeDirection.ts`

- [x] TripSettings: add Day start / Day end time inputs next to the date/days
  fields, writing via `setTrip`.
- [x] DayColumn: render a fixed-height body sized from `dayStart`/`dayEnd` (min
  height even when empty — issue 2); place the morning/afternoon/evening zone
  labels in a left gutter so cards never overlap them (issue 4).
- [x] Scale each card's height by its duration (end−start; timed-without-end →
  1h; untimed → default block) so empty time is visible below the cards (issues
  3, 5); keep the vertical `SortableContext` list intact.
- [x] Add a slightly-pink background to Saturday/Sunday columns via `isWeekend`
  (issue 9).
- [x] Board passes `dayStart`/`dayEnd` to DayColumn (desktop and
  MobileDayView).
- [x] Update `DayColumn.test.tsx` (window height, gutter not covered, card
  scaling, weekend bg) and `TripSettings.test.tsx`.
- [x] run `npm test` — must pass before Task 6.

### Task 6: Transportation cards (issue 13)

**Files:**
- Modify: `src/features/cards/CardEditor.tsx`, `Card.tsx`

- [x] CardEditor: add a "This is transportation" checkbox writing `transport`
  via the card mutators (data field added in Task 1).
- [x] Card.tsx: render transport cards with a distinct style (e.g. transport
  icon + accent border/color).
- [x] Update `CardEditor.test.tsx` and `Card.test.tsx`.
- [x] run `npm test` — must pass before Task 7.

### Task 7: Drag overlay + cross-day placeholder (issue 8)

**Files:**
- Modify: `src/features/board/dndContext.tsx`, `Board.tsx`, `DayColumn.tsx`

- [x] Add a dnd-kit `<DragOverlay>` rendering the dragged card so it follows the
  cursor across day columns instead of disappearing.
- [x] Show a drop indicator on the day column under the pointer (use the
  droppable `over`/`isOver` state) as the "where it lands" hint; keep
  `applyCardDragEnd` unchanged. (ponytail: full live cross-day insertion preview
  is out of scope; overlay + target highlight resolves the disappearing-card
  complaint.)
- [x] Add a Playwright e2e for dragging a card to another day; existing
  `dndHandlers.test.ts` stays green. (Also fixed the drag helper for tall
  columns + removed the stale `import-export.spec.ts` left over from Task 3.)
- [x] run `npm test` and `npm run test:e2e` — must pass before Task 8.

### Task 8: Two stays on the same day split left/right (issue 7)

**Files:**
- Modify: `src/features/accommodation/accommodationSpan.ts`,
  `AccommodationLane.tsx`

- [x] Detect two stays sharing day columns and place them on one row split
  left/right across the shared columns (earlier = left half, later = right
  half); 3+ overlaps fall back to current row stacking.
- [x] Add unit tests in `accommodationSpan.test.ts`; update
  `AccommodationLane.test.tsx`.
- [x] run `npm test` — must pass before Task 9.

### Task 9: Show more days when horizontal space allows (issue 1)

**Files:**
- Modify: `src/features/board/useViewport.ts`, `MobileDayView.tsx`, `Board.tsx`

- [x] Compute how many `w-56` columns fit the viewport (≥1); the narrow pager
  renders that many days and pages by that count (one day when only one fits).
- [x] Update `useViewport.test.tsx`/`MobileDayView.test.tsx` for the fit
  calculation and windowed paging.
- [x] run `npm test` — must pass before Task 10.

### Task 10: Verify acceptance criteria

- [x] run full unit/integration suite (`npm test`) — 230 passed (28 files)
- [x] run e2e (`npm run test:e2e`) — 10 passed
- [x] run linter (`npm run lint`) — 0 errors (3 pre-existing react-refresh warnings)
- [x] verify coverage ≥ 80% (`npm run coverage`) — 90.1% stmts / 89.94% branches

### Task 11: Update documentation

- [x] Update `docs/trip-schema.md` for `dayStart`/`dayEnd`, `card.transport`,
  and the `GET /api/schema` + `$schema` pointer.
- [x] Update `README.md` (import/export removed from UI; agent-only) and
  `CLAUDE.md` (day-window on the doc; transport flag; schema endpoint) where
  internal patterns changed.
