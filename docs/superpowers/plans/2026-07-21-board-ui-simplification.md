# Board UI Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the board chrome and timeline controls so the implemented app matches the clarified design handoff without changing trip data or scheduling behavior.

**Architecture:** Keep the existing React/Yjs data flow and edit modals. Change only presentation and input surfaces: flatten the board shell, consolidate header actions, replace custom time wheels with native validated time inputs, and give the timeline an explicit padded track whose geometry remains the source for drag and resize calculations.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest/Testing Library, Playwright.

## Global Constraints

- Work only in `/Users/O.Vansach/Development/travel-planner/.worktrees/design-handoff-alignment` on `codex/design-handoff-alignment`.
- Preserve `main`'s drag, resize, overlap, swap-day, sync, and Yjs behavior.
- Preserve the 16px mobile textual-control rule that prevents iOS focus zoom.
- Do not add dependencies or change the trip schema.
- Treat the dark handoff outline as a screenshot boundary, not UI: the app must fill the viewport with no exterior sepia gutter or enclosing board border.
- Normal day columns have no outline, radius, or shadow. Active drag feedback may still use a temporary highlight.
- The timeline track must reserve enough top and bottom space for Morning/Evening labels, including for a full-window activity.
- Native time inputs store the existing `HH:mm` values and block invalid trip windows where end is not later than start.

## Acceptance Criteria

1. The board fills the screen; no board-frame outline, rounded screen border, outer margin, or sepia area remains.
2. Day columns have no persistent outlines, radii, or shadows.
3. The edit control beside the trip name opens a compact menu containing `Trip details` and `Cities & colours`; the separate desktop Cities button is gone.
4. Card start time and trip day-window fields are native, formatted, validated `<input type="time">` controls; the custom wheel picker is unused and removed.
5. Individual day columns never show a vertical scrollbar.
6. Empty timeline gaps do not render hover/focus `Add activity` slot areas. The single footer `+ add activity` action remains.
7. The NOON rule and label are absent.
8. The desktop toolbar `Add stay` button and the separate trailing lane `Add stay` button are absent. Uncovered-day gap actions and the mobile menu action remain.
9. Activities sit inside a padded timeline track. Morning and Evening labels remain outside the activity range, and a full-window activity has visible space above and below.
10. Indoor/Outdoor/Transit category labels share the title row and wrap below the title only when width requires it.
11. Each day city picker is triggered by a bare edit icon immediately beside the city name; it opens the existing Auto/No city/city dropdown.
12. The fixed-width sync indicator sits immediately left of the right-side controls, so status text changes do not move those controls.

---

### Task 1: Flatten the screen shell and consolidate the header

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/board/Board.tsx`
- Modify: `src/features/board/BoardToolbar.tsx`
- Modify: `src/features/board/BoardToolbar.test.tsx`
- Modify: `src/App.test.tsx`
- Modify: `e2e/mobile-menu.spec.ts`

**Interfaces:**
- `BoardToolbar` continues to receive `onOpenTrip`, `onOpenCities`, `onOpenShare`, undo/redo, and direction callbacks.
- Remove `BoardToolbarProps.onAddStay`; accommodation creation remains owned by the lane and mobile menu.

- [x] Add failing component tests asserting that the screen frame has no border/margin/radius, the desktop Cities and Add stay buttons are absent, and the edit menu offers Trip details and Cities & colours.
- [x] Add a failing toolbar test that changes sync status and asserts a fixed-width sync container before the right-side controls.
- [x] Remove `bg-surface`, outer vertical padding, and layout gaps from the room app shell so the board fills a white viewport.
- [x] Remove `mx-*`, `rounded-frame`, and border classes from `board-frame`; retain flex sizing and overflow containment.
- [x] Replace the direct edit-trip button with a compact `Popover` menu beside the title. Its two actions close the menu and call `onOpenTrip` or `onOpenCities`.
- [x] Remove the standalone desktop Cities button and toolbar Add stay button.
- [x] Group collaborators, share/menu, undo/redo, and direction controls in a stable right-side block. Put sync immediately before it in a fixed-width, non-shrinking container.
- [x] Run `npm test -- src/App.test.tsx src/features/board/BoardToolbar.test.tsx` and confirm all targeted tests pass.

### Task 2: Replace custom time wheels with native validated inputs

**Files:**
- Modify: `src/features/cards/CardEditor.tsx`
- Modify: `src/features/cards/CardEditor.test.tsx`
- Modify: `src/features/trip/TripModal.tsx`
- Modify: `src/features/trip/TripModal.test.tsx`
- Delete: `src/features/pickers/TimePicker.tsx`
- Delete: `src/features/pickers/TimePicker.test.tsx`
- Delete: `src/features/pickers/timeWheel.ts`
- Delete: `src/features/pickers/timeWheel.test.ts`
- Modify: `e2e/time-picker.spec.ts`
- Modify: `e2e/mobile.spec.ts`

**Interfaces:**
- Card start time remains optional and stores `undefined` when cleared.
- `trip.dayStart` and `trip.dayEnd` remain required `HH:mm` strings.

- [x] Add failing tests proving activity start uses `input[type="time"]`, accepts quarter-hour values, and clears to an untimed card.
- [x] Add failing tests proving day start/end use required `input[type="time"]` controls and reject `dayEnd <= dayStart` with a visible alert without writing an invalid trip.
- [x] Replace `TimePicker` in `CardEditor` with a native time input using `step={900}` and the existing 16px-capable field styling.
- [x] Replace both `TimePicker` instances in `TripModal` with native required time inputs using `step={900}` and guarded change handlers.
- [x] Remove the unused picker and wheel modules and rewrite the Playwright scenarios to use native time inputs directly.
- [x] Keep the iOS regression assertion on representative time and text inputs.
- [x] Run `npm test -- src/features/cards/CardEditor.test.tsx src/features/trip/TripModal.test.tsx` and `npx playwright test e2e/time-picker.spec.ts e2e/mobile.spec.ts --workers=1`.

### Task 3: Simplify day columns and create a padded timeline track

**Files:**
- Modify: `src/features/board/DayColumn.tsx`
- Modify: `src/features/board/DayColumn.test.tsx`
- Modify: `src/features/board/MobileDayView.tsx`
- Modify: `src/features/board/MobileDayView.test.tsx`
- Modify: `src/features/board/dndContext.tsx`
- Modify: `src/features/board/dndContext.test.ts`
- Modify: `e2e/card-height.spec.ts`
- Modify: `e2e/drag-to-time.spec.ts`
- Modify: `e2e/dnd.spec.ts`
- Modify: `e2e/event-resize.spec.ts`

**Interfaces:**
- Add and export a single `TIMELINE_VERTICAL_PADDING_PX` constant from the timeline/card geometry module used by rendering and tests.
- The element with `data-testid="timeline-track"` represents exactly the trip day window and becomes the droppable geometry reference.

- [x] Add failing tests asserting no persistent column border/radius/shadow, no `overflow-y-auto` on `day-body`, no noon divider, and no timeline-slot buttons.
- [x] Add failing geometry tests proving `day-body` height equals the time-window height plus twice the vertical padding and the timeline track begins below Morning and ends above Evening.
- [x] Remove `freeTimelineSlots`, the interactive empty-slot layer, and noon-divider rendering/imports.
- [x] Remove normal column borders, rounding, and shadows while preserving an active drop-target highlight.
- [x] Make `day-body` non-scrolling. Render a positioned `timeline-track` inset by `TIMELINE_VERTICAL_PADDING_PX`; place card list and drag preview inside it.
- [x] Keep Morning/Evening labels pinned to the outer body edges and the footer add-activity action below the body.
- [x] Update `BoardDnd.planFromEvent` to measure `timeline-track` instead of `day-body`, preserving 15-minute snapping and all drop/resize semantics.
- [x] Add a bare icon-only CityPicker trigger immediately after each city name on desktop and mobile; remove the framed full-label trigger and mobile plus-city button.
- [x] Run the affected unit tests and `npx playwright test e2e/card-height.spec.ts e2e/drag-to-time.spec.ts e2e/dnd.spec.ts e2e/event-resize.spec.ts --workers=1`.

### Task 4: Remove redundant stay actions

**Files:**
- Modify: `src/features/accommodation/AccommodationLane.tsx`
- Modify: `src/features/accommodation/AccommodationLane.test.tsx`
- Modify: `src/features/board/Board.test.tsx`
- Modify: `e2e/accommodation.spec.ts`
- Modify: `e2e/mobile-menu.spec.ts`

**Interfaces:**
- `AccommodationLane.onAddStay(startNight)` remains for uncovered-gap buttons.
- Mobile `addStayNonce` remains supported from the mobile menu.

- [x] Add failing tests asserting uncovered gaps retain their in-lane action, but a fully covered trip has no separate Add stay button.
- [x] Remove the trailing right-end Add stay button from `AccommodationLane`.
- [x] Update Board tests to stop looking for a toolbar Add stay action and confirm the mobile menu action still opens the editor.
- [x] Update accommodation Playwright coverage for gap-only creation and full-coverage absence.
- [x] Run `npm test -- src/features/accommodation/AccommodationLane.test.tsx src/features/board/Board.test.tsx` and `npx playwright test e2e/accommodation.spec.ts e2e/mobile-menu.spec.ts --workers=1`.

### Task 5: Put activity categories in the title row

**Files:**
- Modify: `src/features/cards/Card.tsx`
- Modify: `src/features/cards/Card.test.tsx`
- Modify: `e2e/cards.spec.ts`

**Interfaces:**
- Category semantics, colors, and `data-testid="card-category"` remain unchanged.
- Conflict badges remain below the title/time region.

- [x] Add a failing component test proving the title and category share a `flex-wrap` header container and that the category is no longer rendered in the lower badge row.
- [x] Refactor the card header so the edit-title control and optional category chip are siblings in a wrapping row.
- [x] Keep time metadata directly below that wrapping row and keep note, conflict, and link behavior unchanged.
- [x] Run `npm test -- src/features/cards/Card.test.tsx` and `npx playwright test e2e/cards.spec.ts --workers=1`.

### Task 6: Full regression and visual acceptance pass

**Files:**
- Modify only tests needed to describe the approved behavior; do not weaken functional assertions.

- [x] Run `npm test` and require zero failures.
- [x] Run `npm run lint` and require zero errors.
- [x] Run `npm run build` and require exit code 0.
- [x] Run `npx playwright test --workers=1` and require all browser tests to pass.
- [x] Start the local app in test mode, load a populated multi-day trip, and capture desktop and iPhone-width screenshots.
- [x] Inspect both screenshots against all 12 acceptance criteria, plus open the edit menu, city picker, trip modal, card editor, an empty day, and a fully covered stay lane.
- [x] Fix every visible discrepancy, rerun the covering tests, and repeat screenshots until all criteria pass.
