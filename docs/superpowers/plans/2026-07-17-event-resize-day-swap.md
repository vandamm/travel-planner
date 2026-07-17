# Event Resize and Day Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct whole-card movement, two-edge 15-minute resizing, directional collision pushing, and atomic activity-day swaps that preserve displayed cities but not accommodations.

**Architecture:** Keep clock and collision calculations in pure timeline helpers. React components translate pointer geometry into requested times and show previews; document helpers commit final schedules and day swaps as single Yjs transactions. Extend day overrides with an explicit `null` no-city state while keeping absent keys as automatic accommodation inheritance.

**Tech Stack:** React 18, TypeScript, dnd-kit, Yjs, Zod, Vitest, Testing Library, Playwright.

## Global constraints

- All start times and custom durations created by direct manipulation use 15-minute increments.
- Moving or extending toward a visual edge pushes collisions toward that edge; the active timeline direction determines whether this means earlier or later clock times.
- Accommodations never change during a day swap.
- Each completed move, resize, or day swap is one undoable Yjs transaction.
- Preserve the mounted app shell and the board's horizontal and vertical scroll positions.
- Work only in the isolated feature worktree.

---

### Task 1: Establish the quarter-hour duration contract

**Files:**
- Modify: `src/features/cards/cardHeight.ts`
- Modify: `src/features/cards/cardHeight.test.ts`
- Modify: `src/data/doc.ts`
- Modify: `src/data/doc.test.ts`
- Modify: `src/data/tripSchema.ts`
- Modify: `src/data/tripSchema.test.ts`
- Modify: `src/features/cards/CardEditor.tsx`
- Modify: `src/features/cards/CardEditor.test.tsx`
- Modify: `worker/src/snapshots.test.ts`

**Produces:** shared 15-minute constants and custom durations of `0.25`, `0.5`, `0.75`, or any larger quarter-hour multiple.

- [ ] **Step 1: Write failing domain tests**

Add tests that:

```ts
expect(resolvedDurationHours(customCard(0.25), START, END)).toBe(0.25)
expect(cardSchema.safeParse(customCard(0.25)).success).toBe(true)
expect(cardSchema.safeParse(customCard(0.3)).success).toBe(false)
```

Verify `addCard`/`updateCard` preserve valid quarter hours and normalize invalid or sub-minimum values.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```sh
npm test -- src/features/cards/cardHeight.test.ts src/data/doc.test.ts src/data/tripSchema.test.ts
```

- [ ] **Step 3: Implement the shared contract**

Export `SNAP_MINUTES = 15`, `MIN_CARD_MINUTES = 15`, and conversion helpers from `cardHeight.ts`. Validate custom duration with `.min(0.25).multipleOf(0.25)`. Use the same predicate in document normalization.

- [ ] **Step 4: Update the editor and generated schema expectations**

Set the duration field to `min="0.25"` and `step="0.25"`, accept quarter-hour values on submit, and update Worker schema snapshots.

- [ ] **Step 5: Run focused tests**

Run:

```sh
npm test -- src/features/cards/cardHeight.test.ts src/data/doc.test.ts src/data/tripSchema.test.ts src/features/cards/CardEditor.test.tsx worker/src/snapshots.test.ts
```

- [ ] **Step 6: Commit**

Commit: `feat: support quarter-hour activity durations`

---

### Task 2: Replace forward-only pushing with directional scheduling

**Files:**
- Create: `src/features/board/timelineSchedule.ts`
- Create: `src/features/board/timelineSchedule.test.ts`
- Modify: `src/features/board/dndHandlers.ts`
- Modify: `src/features/board/dndHandlers.test.ts`

**Produces:** pure schedule planning for move and resize operations, with document mutation remaining at the boundary.

- [ ] **Step 1: Write failing pure scheduling tests**

Cover:

- a later move pushing a later collision chain forward;
- a visual-top move pushing its collision chain toward the top in both timeline directions;
- a visual-bottom move pushing its collision chain toward the bottom in both timeline directions;
- top-edge and bottom-edge extensions pushing toward their edited visual edge;
- shrinking without moving other cards;
- 15-minute rounding;
- day-start/day-end clamping;
- an impossible chain leaving unrelated schedules unchanged.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```sh
npm test -- src/features/board/timelineSchedule.test.ts src/features/board/dndHandlers.test.ts
```

- [ ] **Step 3: Implement pure planners**

Add helpers that accept the active interval, requested interval, other timed cards, day bounds, and edit kind. Return the active start/duration plus pushed card starts without mutating the document.

Translate the visual edit direction through `TimeDirection`. Pack forward from the active end for chronologically later edits and backward from the active start for chronologically earlier edits. Preserve existing chronological order inside each pushed chain.

- [ ] **Step 4: Route card drops through the planner**

Change `dropTimeForOffset` to 15-minute snapping. Replace `pushCollisions` in `dndHandlers.ts` with the pure move planner and pass its complete update list to `updateCardSchedules`.

- [ ] **Step 5: Prove atomic writes**

Retain the existing Yjs update-count test and add an earlier-direction equivalent.

- [ ] **Step 6: Run focused tests**

Run:

```sh
npm test -- src/features/board/timelineSchedule.test.ts src/features/board/dndHandlers.test.ts
```

- [ ] **Step 7: Commit**

Commit: `feat: push timeline collisions in edit direction`

---

### Task 3: Add whole-card dragging and two-edge resizing

**Files:**
- Create: `src/features/board/cardResize.ts`
- Create: `src/features/board/cardResize.test.ts`
- Modify: `src/features/cards/Card.tsx`
- Modify: `src/features/cards/Card.test.tsx`
- Modify: `src/features/board/DayColumn.tsx`
- Modify: `src/features/board/DayColumn.test.tsx`
- Modify: `src/features/board/Board.tsx`
- Modify: `src/features/board/dndContext.tsx`
- Modify: `src/features/board/dndContext.test.ts`

**Produces:** direct dragging from the card surface and accessible top/bottom resize controls for timed cards.

- [ ] **Step 1: Write failing component tests**

Assert that:

- the old `Drag …` handle is absent;
- pointer listeners are attached to the card surface;
- clicking without dragging still calls `onEdit`;
- timed cards expose `Resize … start` and `Resize … end`;
- untimed cards do not expose timeline resize handles;
- pointer events on links and resize handles do not start a move.

- [ ] **Step 2: Write failing resize behavior tests**

Use `cardResize.test.ts` to cover top/bottom pointer deltas in both display directions, 15-minute preview values, preset-to-custom conversion, minimum duration, collision pushes, and one atomic commit.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```sh
npm test -- src/features/cards/Card.test.tsx src/features/board/DayColumn.test.tsx src/features/board/cardResize.test.ts src/features/board/dndContext.test.ts
```

- [ ] **Step 4: Move the drag activator to the card**

Keep `useDraggable`, its pointer-distance activation constraint, keyboard sensor, overlay, and coordinate-based drop calculation. Pass activator props to the card article instead of rendering a handle. Exclude resize controls and links from move activation.

- [ ] **Step 5: Implement resize preview and commit**

Use pointer capture on top/bottom controls. Convert pointer delta to minutes at `PX_PER_HOUR`, account for display direction, snap to 15 minutes, and preview height/position locally. On pointer release, call the pure resize planner and commit duration plus schedule changes in one document transaction.

Extend the schedule update helper or add `updateCardTimeline` so the active card's `duration: 'custom'`, `durationHours`, and any pushed starts share the transaction.

- [ ] **Step 6: Add keyboard resizing**

Arrow keys resize by 15 minutes; Shift+Arrow resizes by one hour. Use the same pure planner and boundary behavior as pointer resizing.

- [ ] **Step 7: Run focused tests**

Run:

```sh
npm test -- src/features/cards/Card.test.tsx src/features/board/DayColumn.test.tsx src/features/board/cardResize.test.ts src/features/board/dndContext.test.ts
```

- [ ] **Step 8: Commit**

Commit: `feat: resize and drag activities directly`

---

### Task 4: Add explicit no-city overrides and atomic day swapping

**Files:**
- Modify: `src/data/schema.ts`
- Modify: `src/data/doc.ts`
- Modify: `src/data/doc.test.ts`
- Modify: `src/data/cityResolution.ts`
- Modify: `src/data/cityResolution.test.ts`
- Modify: `src/data/tripSchema.ts`
- Modify: `src/data/tripSchema.test.ts`
- Modify: `src/data/applyTrip.ts`
- Modify: `src/data/applyTrip.test.ts`
- Modify: `src/data/exportTrip.ts`
- Modify: `src/data/exportTrip.test.ts`
- Create: `src/features/board/DaySwapModal.tsx`
- Create: `src/features/board/DaySwapModal.test.tsx`
- Modify: `src/features/board/DayColumn.tsx`
- Modify: `src/features/board/DayColumn.test.tsx`
- Modify: `src/features/board/Board.tsx`
- Modify: `src/features/board/Board.test.tsx`
- Modify: `src/features/board/MobileDayView.tsx`
- Modify: `src/features/board/MobileDayView.test.tsx`
- Modify: `worker/src/snapshots.test.ts`

**Produces:** absent override = Auto, `null` = No city, string = pinned city; a dialog-driven two-day swap.

- [ ] **Step 1: Write failing override tests**

Prove that `null` blocks accommodation inheritance, survives import/export, passes schema validation without referential lookup, and is removed safely when clearing an override back to Auto.

- [ ] **Step 2: Implement the override model**

Use `Record<string, string | null>`. Change `setDayCityOverride` so `undefined` deletes the key, `null` stores explicit no-city, and a string stores a city. Update current Auto callers from `null` to `undefined`; add a `No city` picker option.

- [ ] **Step 3: Write failing atomic swap tests**

Set up two populated days with different resolved cities and accommodations. Verify:

- all cards exchange `dayKey`;
- card time, duration, and order stay unchanged;
- displayed cities exchange through explicit overrides;
- a cityless day remains cityless;
- accommodations are byte-for-byte unchanged;
- the document emits one update.

- [ ] **Step 4: Implement `swapActivityDays`**

Resolve both displayed cities before starting the transaction. Inside one transaction, exchange matching cards' day keys and set the opposite city's explicit override, using `null` for no city. Do not touch accommodations.

- [ ] **Step 5: Add the day-header workflow**

Add a `Swap day` action to `DayColumn`. Let `Board` own the selected source day and render `DaySwapModal` with all other trip dates. Show both dates/cities before confirmation and call `swapActivityDays` once.

Use the same action in the mobile `DayColumn`.

- [ ] **Step 6: Run focused tests**

Run:

```sh
npm test -- src/data/doc.test.ts src/data/cityResolution.test.ts src/data/tripSchema.test.ts src/data/applyTrip.test.ts src/data/exportTrip.test.ts src/features/board/DaySwapModal.test.tsx src/features/board/DayColumn.test.tsx src/features/board/Board.test.tsx src/features/board/MobileDayView.test.tsx worker/src/snapshots.test.ts
```

- [ ] **Step 7: Commit**

Commit: `feat: swap activity days and displayed cities`

---

### Task 5: Preserve the mounted layout and verify real interactions

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `e2e/drag-to-time.spec.ts`
- Create: `e2e/event-resize.spec.ts`
- Create: `e2e/day-swap.spec.ts`

**Produces:** no loading flash or scroll reset after collaborative writes, plus browser coverage for each direct manipulation.

- [ ] **Step 1: Add the pending mounted-shell regression**

Write the test that transitions room status `connecting → synced → connecting` and asserts the same app-shell node remains mounted without showing `Loading`.

- [ ] **Step 2: Implement one-time initial loading**

Track whether the initial connection has resolved. Show the loading screen only before that first resolution; keep `AppShell` mounted during later synchronizing states.

- [ ] **Step 3: Update and add Playwright tests**

Cover:

- dragging from the card body to a non-hour coordinate yields a 15-minute time;
- moving toward the visual top and bottom pushes the collision chain in the matching direction in both timeline modes;
- top and bottom pointer resizing preview and commit quarter-hour durations;
- extending in either direction pushes neighboring cards;
- swapping two days exchanges activities and visible cities but not accommodation bars;
- each operation preserves `board-scroll.scrollLeft`, `day-body.scrollTop`, and window scroll.

- [ ] **Step 4: Run focused browser tests**

Run:

```sh
npx playwright test e2e/drag-to-time.spec.ts e2e/event-resize.spec.ts e2e/day-swap.spec.ts --project=chromium
```

- [ ] **Step 5: Test manually in the browser**

Use the real local app and pointer coordinates. Exercise both Morning → Evening and Evening → Morning, long horizontal scroll, both resize edges, links, click-to-edit, collision chains, and a day swap involving an accommodation-derived city.

- [ ] **Step 6: Commit**

Commit: `fix: preserve board position during timeline edits`

---

### Task 6: Full verification and integration

- [ ] **Step 1: Run all checks**

Run:

```sh
npm test
npm run lint
npm run build
npx playwright test e2e/drag-to-time.spec.ts e2e/event-resize.spec.ts e2e/day-swap.spec.ts --project=chromium
git diff --check
```

- [ ] **Step 2: Review scope**

Confirm the diff contains only the planned implementation, tests, and design/plan documents. Do not add unrelated files from the main checkout.

- [ ] **Step 3: Commit any final verification adjustments**

Use a narrowly scoped commit message.

- [ ] **Step 4: Merge and push**

After all checks pass, merge `codex/event-resize-day-swap` into `main` and push `main`.
