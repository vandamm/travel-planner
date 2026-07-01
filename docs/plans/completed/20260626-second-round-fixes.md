# Travel Planner — Second Round of Fixes

## Overview

A round of 9 user-reported fixes after live use of the day-board. They span the
date/time inputs, the accommodations ("stays") lane, city handling, per-day city
overrides, and card movement/sizing. Each is independent enough to ship and test
on its own.

The 9 items (with the decisions taken during planning):

1. **European date/time format** — *keep native pickers* (user decision). Native
   `<input type="date|time">` renders in the **OS/browser locale**; HTML offers no
   way to force `DD.MM.YYYY` / 24h. Scope is therefore limited to the cheap native
   levers + making every *displayed* date/time European. (See Technical Details.)
2. **Stays row always visible** + move "Add stay" to the right end of that row;
   show an "Add stay" button on the first day of every uncovered gap.
3. **Add-stay popup preselects** the first non-covered date as the start.
4. **Random color** auto-selected when adding a new city (still overridable).
5. **Overlapping stays share one row** — on a shared changeover day the outgoing
   bar ends at the middle and the incoming bar starts at the middle (they meet
   mid-day). Genuine double-bookings (two stays claiming the same night) still
   stack on separate rows.
6. **Per-day city override UI** — the `setDayCityOverride` mutator exists but no UI
   calls it. Add a control in the day-column header.
7. **Drag untimed cards to a time of day** — dragging an untimed card vertically
   assigns it a start time derived from the drop position (drop in the evening →
   evening time). **Key assumption** (see Technical Details).
8. **Card height presets** — a selector between *exact duration* and presets
   *small / half-day / whole-day*.
9. **Picker chaining** — after the first night is chosen, the last-night picker
   opens (`.showPicker()`, fallback `.focus()`), with a sensible default end.

## Context (from discovery)

Files/components involved:
- **Dates/times:** `src/features/trip/TripSettings.tsx`, `src/features/accommodation/AccommodationEditor.tsx`, `src/features/cards/CardEditor.tsx`, `src/features/cards/Card.tsx`, `src/features/board/DayColumn.tsx`, `index.html`, `src/data/days.ts` (`DAY_KEY_FORMAT`).
- **Stays lane:** `src/features/accommodation/AccommodationLane.tsx`, `AccommodationBar.tsx`, `accommodationSpan.ts` (`accommodationColumnSpan`, `packAccommodations`), `src/features/board/Board.tsx`, `src/data/cityResolution.ts` (`accommodationCoversDay`).
- **Cities / overrides:** `src/features/cities/CityManager.tsx`, `src/features/board/DayColumn.tsx`, `src/features/board/Board.tsx`, `src/data/doc.ts` (`addCity`, `setDayCityOverride`, `getDayOverride`, `listDayOverrides`), `src/data/cityResolution.ts` (`resolveDayCity`).
- **Cards:** `src/data/schema.ts` (`Card`), `src/data/tripSchema.ts` (`cardSchema`), `src/features/cards/cardSort.ts`, `src/features/board/DayColumn.tsx` (`cardHeightPx`, `PX_PER_HOUR`, `DEFAULT_CARD_HOURS`), `src/features/board/dndHandlers.ts`, `dndContext.tsx`, `src/data/doc.ts` (`addCard`, `updateCard`, `reorderCards`), `src/data/applyTrip.ts`, `exportTrip.ts`.

Patterns found:
- Yjs doc is the single source of truth; mutate **only** through `src/data/doc.ts`
  inside `doc.transact(...)`. Entities are nested `Y.Map`s.
- Shared pure logic lives in `src/data/` (imported by client *and* Worker): keep
  new coverage helpers there, browser-free.
- date-fns v4 is installed; `DAY_KEY_FORMAT = 'yyyy-MM-dd'`. `DayColumn` already
  formats day labels `dd.MM`.
- dnd-kit (`@dnd-kit/core` + `/sortable`) drives card drag; `applyCardDragEnd`
  reorders and persists via `reorderCards`. Untimed reorder already works; #7
  changes drop semantics, not the dnd plumbing.

Dependencies identified: **no new dependencies** (native pickers kept; date-fns
already present).

Confirmed gaps: `setDayCityOverride` has **no UI caller**; there is **no color
palette / random-color helper**; `Card` has **no size/height field**; there is
**no uncovered-day (gap) helper**.

## Development Approach

- **Testing approach: TDD (red-green)** — required by repo `CLAUDE.md`. Write a
  failing test first, then implement to green.
- Prefer Playwright e2e against the real UI (app is local-first; e2e runs with no
  backend). Reserve Vitest for pure `src/data/` logic; verify sync with a
  two-`Y.Doc` integration test where relevant.
- `src/data/devBridge.ts` exposes the live doc + mutators on `window.__planner`
  in dev builds — use it to seed data in e2e.
- Complete each task fully (incl. tests passing) before the next. Small, focused
  changes. Maintain backward compatibility (all new schema fields optional).
- **Every task includes new/updated tests; all tests pass before the next task.**
- Keep this plan in sync: `[x]` when done, ➕ for new tasks, ⚠️ for blockers.

## Testing Strategy

- **Unit/integration (Vitest):** coverage helpers, color palette, overlap span
  packing, card height math, card schema round-trip, drag-time-assignment logic.
- **E2E (Playwright):** every UI behavior — gap "Add stay" buttons, preselected
  start, picker chaining, random color, day override control, height selector,
  untimed-card drag-to-evening, overlap rendering.
- E2E tests live in `e2e/`; treat them with the same rigor as unit tests (must
  pass before the next task).

## Progress Tracking

- Mark completed items with `[x]` immediately.
- Add newly discovered tasks with ➕ prefix; blockers with ⚠️ prefix.
- Update the plan if scope changes during implementation.

## What Goes Where

- **Implementation Steps** (`[ ]`): code, tests, docs achievable in this repo.
- **Post-Completion** (no checkboxes): OS-locale picker note, manual visual checks.

## Implementation Steps

### Task 1: Uncovered-day (gap) helpers — shared pure logic
- [x] add `uncoveredDays(days, accommodations)` and `firstUncoveredDay(days, accommodations)` to `src/data/cityResolution.ts` (reuse `accommodationCoversDay`); a day is "covered" if any accommodation covers it
- [x] `firstUncoveredDay` returns the first day key not covered by any stay (or `undefined` if all covered)
- [x] also expose gap *ranges* (contiguous uncovered day keys) via `uncoveredGaps` for the per-gap buttons in Task 3
- [x] write Vitest tests: no stays (all uncovered), full coverage (none), leading/middle/trailing gaps, adjacent stays with no gap
- [x] run `npm test` — must pass before next task

### Task 2: Random color when adding a city (#4)
- [x] add `src/features/cities/colors.ts`: `CITY_PALETTE` (≈12 distinct hex colors) + `randomCityColor(used: string[])` preferring a palette color not already used by existing cities
- [x] in `CityManager.tsx`, initialize the color state from `randomCityColor(existingColors)` instead of the hard-coded `#3b82f6`; re-roll the default after each successful add; keep the `<input type="color">` so the user can override
- [x] write Vitest tests for `randomCityColor` (avoids used colors; still returns a palette color when all are used)
- [x] update/extend `CityManager.test.tsx`: a newly opened form has a non-empty palette color preselected; adding twice yields different default colors
- [x] run `npm test` — must pass before next task

### Task 3: Stays row always visible + Add-stay button + per-gap buttons (#2)
- [x] keep `AccommodationLane` always rendered when `days.length > 0`; move the global "Add stay" button out of the board header into the **right end** of the lane row (kept on the mobile header, which has no lane)
- [x] render an "Add stay" button on the **first day of each uncovered gap** (from Task 1 gap ranges), positioned in that day's column; clicking opens the editor in create mode seeded with that gap's start (passed through to Task 4)
- [x] ensure the lane row is visible even when there are zero accommodations (so the right-end "Add stay" and gap buttons show)
- [x] write e2e: with no stays, an "Add stay" affordance is visible; with a middle gap, the gap's first day shows an "Add stay" button; the right-end button is present
- [x] run `npm run test:e2e` (relevant spec) — must pass before next task

### Task 4: Add-stay popup — preselect start + default end + picker chaining (#3, #9)
- [x] in `Board.tsx`, pass `defaultStartNight = firstUncoveredDay(days, accommodations)` (fallback `trip.startDate`/`days[0]`) and, when opened from a gap button, that gap's first day; set `defaultEndNight = defaultStartNight` (one night)
- [x] in `AccommodationEditor.tsx`, when the first-night value changes: if end < start, set end = start; then open the last-night picker via `endRef.current.showPicker()` with a `.focus()` fallback (guard for browsers without `showPicker`)
- [x] keep inputs native; values stay ISO (`yyyy-MM-dd`)
- [x] write e2e: opening "Add stay" with a gap preselects the gap's first day as start; selecting a first night focuses/opens the last-night field; saving persists the stay
- [x] run `npm run test:e2e` — must pass before next task

### Task 5: Overlapping stays share one row — split the shared day (#5)
- [x] in `accommodationSpan.ts`, detect a **changeover day** shared by an outgoing stay (its `endNight`) and an incoming stay (its `startNight`); mark the outgoing stay `endHalf` and the incoming stay `startHalf`, and place such chained stays on the **same row** (they no longer horizontally overlap)
- [x] keep separate-row stacking for **genuine** overlaps (two stays both covering the same night beyond a single changeover boundary)
- [x] in `AccommodationLane`/`AccommodationBar`, apply a half-day inset: `startHalf` → bar starts at the middle of its first day; `endHalf` → bar ends at the middle of its last day (use `calc()` on the 14rem column width incl. 0.75rem gap)
- [x] write Vitest tests in `accommodationSpan.test.ts`: A(D1–D3)+B(D3–D5) → same row, A `endHalf`, B `startHalf`; true overlap A(D1–D4)+B(D2–D5) → separate rows; non-adjacent stays unchanged
- [x] write e2e/visual: two stays sharing a changeover day render on one row meeting mid-day
- [x] run `npm test` and the e2e spec — must pass before next task

### Task 6: Per-day city override control in the day header (#6)
- [x] add a control to `DayColumn` header (e.g. a small select/popover on the city band) listing cities + an "Auto" option; "Auto" clears the override
- [x] wire it through `Board.tsx` to `setDayCityOverride(doc, dayKey, cityId | null)`; show an indicator when a day has a **manual** override vs an accommodation-resolved city
- [x] confirm `resolveDayCity` precedence is unchanged (override > covering accommodation > none) and that `removeCity` still cascades to clear overrides
- [x] write e2e: set a day's city via the header → header color updates; choose "Auto" → reverts to the accommodation-resolved city
- [x] run `npm run test:e2e` — must pass before next task (ran via temp alt-port config; :5173 was occupied by an unrelated dev server)

### Task 7: Card height presets (#8)
- [x] add optional `size?: 'auto' | 'small' | 'half' | 'full'` to `Card` (`schema.ts`); `auto` (default/absent) = current behavior (height from start/end time; 1h default)
- [x] add `size` to `cardSchema` in `tripSchema.ts` (optional enum) so `GET /api/schema`, `applyTrip`, and `exportTrip` carry it; thread `size` through `addCard`/`updateCard` in `doc.ts`
- [x] update `cardHeightPx` in `DayColumn.tsx`: `small` ≈ 0.5h; `half` = half the day window (`dayEnd−dayStart`); `full` = the whole day window; `auto` unchanged (extracted to pure `src/features/cards/cardHeight.ts` so it's unit-testable; takes `dayStart`/`dayEnd`)
- [x] add a "Height" selector to `CardEditor.tsx` (Exact duration / Small / Half day / Whole day)
- [x] write Vitest: `cardHeightPx` for each size incl. window-relative half/full; card schema round-trip with `size` (apply → export)
- [x] write e2e: set a card to "Whole day" → its height grows; default cards unaffected
- [x] run `npm test` and the e2e spec — must pass before next task (e2e ran via temp alt-port config; :5173 was occupied by an unrelated dev server)

### Task 8: Drag an untimed card to a time of day (#7)
- [x] in `dndHandlers.ts` (`applyCardDragEnd`): when the dragged card is **untimed** and dropped within a day, derive a `startTime` from the drop position — from the neighbor card(s) at the drop slot (e.g. the over-card's time, or the midpoint between the cards above/below), snapped to 15 min and clamped to the trip day window; persist via `updateCard`
- [x] if the drop slot has no timed neighbors, fall back to the existing untimed reorder (`reorderCards`) — no time assigned
- [x] keep direction-awareness (`timeDirection`) so "lower = later" holds in both directions (slot read in canonical order, so direction is handled uniformly)
- [x] write Vitest for the time-derivation helper: drop between 12:00 and 18:00 → ~15:00; drop after the last timed card → later time; drop among untimed-only → no time, reorder only
- [x] write e2e: drag an untimed card toward the evening of a day with timed cards → it gains an evening time and sorts there
- [x] run `npm test` and `npm run test:e2e` — must pass before next task (e2e ran via temp alt-port config; :5173 was occupied by an unrelated dev server)

### Task 9: European-format levers for native pickers + displayed dates audit (#1)
- [x] set `lang="de"` on `<html>` in `index.html` (Firefox honors it for native date inputs; Chrome/Safari follow OS locale — documented in Post-Completion)
- [x] audit every place a date/time is **displayed** (not the native widget): `DayColumn` labels (`dd.MM`, via new helper), card times (`HH:mm` 24h range, via new helper), accommodation bar labels (label-only, no date), no tooltips render dates — all European; extracted shared `formatDay`/`formatTimeRange` to `src/data/dateFormat.ts`
- [x] keep all stored values ISO (`yyyy-MM-dd` / `HH:mm`); leave native inputs in place per the keep-native decision
- [x] write/extend a Vitest test for the shared formatter(s) (`dateFormat.test.ts`); e2e asserting displayed day labels are `dd.MM` (`euro-format.spec.ts`)
- [x] run `npm test` (292 pass) and `npm run test:e2e` (ran euro-format via temp alt-port config; :5173 occupied by an unrelated dev server)

### Task 10: Verify acceptance criteria
- [x] verify each of the 9 items behaves as described in Overview (each has passing unit and/or e2e tests: #1 euro-format.spec/dateFormat.test, #2/#3/#9 accommodation.spec, #4 colors.test, #5 accommodationSpan.test, #6 day-override.spec, #7 drag-to-time.spec/dndHandlers.test, #8 card-height.spec/cardHeight.test)
- [x] verify edge cases: all-days-covered (`firstUncoveredDay` undefined / `uncoveredGaps` []), single-day trip (`generateDays(start,1)` → one day, one gap button), no cities (`cityId: undefined`), true double-booking still stacks ("genuinely-overlapping stays on separate rows"), `auto` card height unchanged ("explicit auto == absent") — all covered by passing tests
- [x] run the full unit/integration suite (`npm test`) — 292 pass
- [x] run the full e2e suite (`npm run test:e2e`) — 18 pass (alt-port temp config; :5173 occupied by an unrelated dev server)
- [x] run `npm run lint` — 0 errors (3 pre-existing react-refresh warnings, unrelated to this work)
- [x] run `npm run coverage` — 90.99% stmts / 91.62% branch on `src/data/`; new shared helpers at/near 100%

### Task 11: [Final] Update documentation
- [x] update `docs/` schema docs for the new `Card.size` field (added to `trip-schema.md` cards example + field-rules table; confirmed `GET /api/schema` = `zodToJsonSchema(tripDocumentSchema)` publishes the `size` enum)
- [x] update `README.md` / `CLAUDE.md` where behavior changed: per-day city override UI, stays-lane gap buttons, drag-untimed-to-time semantics, native-picker locale note, card height presets
- [x] note any new shared `src/data/` helpers (coverage) in `CLAUDE.md`'s shared-modules section (added `uncoveredDays`/`firstUncoveredDay`/`uncoveredGaps` to the `cityResolution.ts` note + new `dateFormat.ts` entry)

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`.*

## Technical Details

**#1 native picker (kept):** there is no HTML/CSS/JS API to force a native
`<input type="date|time">` into `DD.MM.YYYY` / 24h — the browser uses the OS
locale (Chrome/Safari) or document `lang` (Firefox). So #1 is scoped to: root
`lang="de"`, ISO storage, and European-formatted **display** everywhere outside
the native widget. Getting a European *widget* in Chrome/Safari requires the
user's OS region to be European (Post-Completion note) — or the non-native
approach that was declined.

**#5 geometry:** column width is `14rem` with a `0.75rem` gap (lane is a CSS grid
mirroring the day flex). Half-day inset = `calc((14rem + 0.75rem) / 2)` applied as
`margin-left` (`startHalf`) or `margin-right` (`endHalf`) on the bar so two chained
stays meet at the middle of the shared day on one grid row. `packAccommodations`
gains the changeover detection that lets a chained pair share a row.

**#7 time assignment (key assumption):** the day column is a *stacked* timeline
(card heights ≈ durations), not an absolute clock ruler, so drop position is
interpreted **relative to neighbor cards**, not by pixel→clock math. Dropping an
untimed card next to timed cards assigns a start time inferred from those
neighbors (midpoint / adjacent time), snapped to 15 min. This converts the card to
timed at that time — the user can clear the time in the editor to make it untimed
again. If the user prefers cards to stay untimed with a free vertical offset
instead, that's the fallback design (store an offset rather than a `startTime`).

**Card `size` (#8):** new optional enum; absent = `auto`. Must round-trip through
`tripSchema` (zod) → `applyTrip`/`exportTrip` → `GET /api/schema`. All other new
fields stay optional for backward compatibility and clean import/export.

## Post-Completion

**Manual verification:**
- Confirm the European date/time *display* in a fresh browser; confirm the
  split-the-shared-day overlap looks right with real check-in/out data.
- Confirm drag-untimed-to-evening feels right; adjust the snap interval / neighbor
  inference if needed (the most likely item to iterate on).

**Environment note (not fixable in code):**
- Native date/time **picker widgets** render in the OS/browser locale. On
  Chrome/Safari with an en-US OS region they show US format regardless of app
  code. To see a European picker widget, set the OS/browser region to a European
  locale. (In-app *displayed* dates are European regardless.)
