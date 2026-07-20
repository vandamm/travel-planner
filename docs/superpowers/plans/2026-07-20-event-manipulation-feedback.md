# Event Manipulation Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make activity movement and resizing overlap-safe and show the approved live timing hint throughout either interaction.

**Architecture:** Keep snapping and day-boundary normalization in pure timeline helpers, but remove collision packing so mutations affect only the active activity. Share one presentational timing-hint component between the dnd overlay and the local resize preview. Derive drag previews and commits from the same pure drop plan.

**Tech Stack:** React 18, TypeScript, dnd-kit, Yjs, Tailwind CSS, Vitest, Testing Library, Playwright.

## Global constraints

- Work only in the isolated feature worktree.
- Moving and resizing snap to 15-minute increments.
- A manipulation never changes another activity's `dayKey`, `startTime`, or duration.
- Overlaps remain valid and use the existing conflict marker after release.
- A completed interaction is one Yjs transaction; a cancelled interaction writes nothing.
- Keep whole-card dragging, both resize edges, reverse timeline direction, keyboard resizing, and day-boundary clamping.
- Keep the mounted list item and scroll container stable during all preview updates.
- Use design tokens for the approved hint colors.

---

### Task 1: Remove collision pushing

**Files:**
- Modify: `src/features/board/timelineSchedule.ts`
- Modify: `src/features/board/timelineSchedule.test.ts`
- Modify: `src/features/board/dndHandlers.ts`
- Modify: `src/features/board/dndHandlers.test.ts`
- Modify: `src/features/board/cardResize.ts`
- Modify: `src/features/board/cardResize.test.ts`

**Produces:** snapped move and resize plans that update only the active activity.

- [ ] **Step 1: Replace pushing expectations with overlap expectations**

Update pure planner tests to assert normalization without neighbor changes:

```ts
const result = planTimelineSchedule({
  active: interval('active', 8 * 60, 60),
  requested: { start: 10 * 60, duration: 60 },
  dayStart: 6 * 60,
  dayEnd: 21 * 60,
  edit: 'move-bottom',
  direction: 'down',
})

expect(result).toEqual({
  activeStart: 10 * 60,
  activeDuration: 60,
})
```

In `dndHandlers.test.ts`, drop an activity onto an occupied time and assert that the active card moves while every neighbor retains its original time. Cover same-day and cross-day drops.

In `cardResize.test.ts`, extend each edge into a neighbor in both timeline directions and assert that only the active activity changes.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```sh
npm test -- src/features/board/timelineSchedule.test.ts src/features/board/dndHandlers.test.ts src/features/board/cardResize.test.ts
```

- [ ] **Step 3: Simplify the timeline plan**

Delete `pushesLater`, `packLater`, and `packEarlier`. Remove `pushed` from `TimelineSchedulePlan`. Keep `normalizeRequested` and return only:

```ts
export interface TimelineSchedulePlan {
  activeStart: number
  activeDuration: number
}

export function planTimelineSchedule(input: TimelineScheduleInput): TimelineSchedulePlan {
  return normalizeRequested(input)
}
```

Remove `others` from `TimelineScheduleInput` and every call site. Keep `edit` and `direction` because top-edge normalization still depends on the visual timeline direction.

- [ ] **Step 4: Limit document writes to the active activity**

In `applyCardDrop`, pass one schedule update:

```ts
updateCardSchedules(doc, [
  { id: activeId, dayKey: targetDayKey, startTime: clockString(result.activeStart) },
])
```

Remove `pushed` from `CardResizePlan`. In `applyCardResize`, update the active card's custom duration and active schedule in the existing single transaction. Do not read neighbor cards for resize planning once the planner no longer needs them.

- [ ] **Step 5: Verify focused behavior**

Run:

```sh
npm test -- src/features/board/timelineSchedule.test.ts src/features/board/dndHandlers.test.ts src/features/board/cardResize.test.ts
```

- [ ] **Step 6: Commit**

Commit: `fix: allow activity manipulation to overlap`

---

### Task 2: Build the approved timing hint and subtle resize affordances

**Files:**
- Modify: `tailwind.config.js`
- Create: `src/features/cards/EventTimingHint.tsx`
- Create: `src/features/cards/EventTimingHint.test.tsx`
- Modify: `src/features/cards/Card.tsx`
- Modify: `src/features/cards/Card.test.tsx`

**Produces:** one design-system component for live timing and quieter normal-card resize controls.

- [ ] **Step 1: Write failing timing-hint tests**

Cover a timed hint, an untimed hint, minute formatting, hidden card details, and the approved semantic classes:

```tsx
render(<EventTimingHint startTime="10:15" durationHours={1.75} />)

expect(screen.getByTestId('event-timing-start')).toHaveTextContent('10:15')
expect(screen.getByTestId('event-timing-end')).toHaveTextContent('12:00')
expect(screen.getByTestId('event-timing-duration')).toHaveTextContent('1h 45m')
expect(screen.queryByText(/Moving activity/i)).not.toBeInTheDocument()
```

Add `Card.test.tsx` assertions that resize buttons retain their full hit target and accessible labels, while the visible hairline is hidden at rest and appears on hover or focus.

- [ ] **Step 2: Run the component tests and confirm failure**

Run:

```sh
npm test -- src/features/cards/EventTimingHint.test.tsx src/features/cards/Card.test.tsx
```

- [ ] **Step 3: Add semantic manipulation colors**

Extend the Tailwind palette:

```js
manipulation: {
  bg: '#f3f5f7',
  border: '#dde3e9',
  text: '#34465a',
  muted: '#6f7e8e',
  duration: '#4f6275',
},
```

- [ ] **Step 4: Implement `EventTimingHint`**

Accept `startTime: string | null` and `durationHours: number`. Use `clockMinutes` and `clockString` to derive the end time. Format duration from integer minutes so quarter hours render as `15m`, `1h`, or `1h 45m`.

Use the approved visual contract:

```tsx
<article
  data-testid="event-timing-hint"
  className="relative z-20 flex h-full min-h-[84px] flex-col justify-center rounded-card border border-manipulation-border bg-manipulation-bg px-3 font-sans text-manipulation-text"
>
  <div className="flex items-center gap-2 text-[22px] font-medium leading-none">
    <span data-testid="event-timing-start">{startTime ?? '—'}</span>
    <span aria-hidden className="text-manipulation-muted">→</span>
    <span data-testid="event-timing-end">{endTime ?? '—'}</span>
  </div>
  <span
    data-testid="event-timing-duration"
    className="mt-2 border-t border-manipulation-text/10 pt-2 text-center text-base font-medium text-manipulation-duration"
  >
    {durationLabel}
  </span>
</article>
```

Do not render a title, label, badge, link, resize handles, or call-to-action styling.

- [ ] **Step 5: Subdue the normal resize marks**

Keep each resize button's current height and pointer behavior. Replace the full-width visible bar with a centered, short, one-pixel hairline. Set it to transparent at rest and faintly visible on button hover or focus. Preserve the row-resize cursor and focus-visible ring.

- [ ] **Step 6: Verify and commit**

Run:

```sh
npm test -- src/features/cards/EventTimingHint.test.tsx src/features/cards/Card.test.tsx
npm run build
```

Commit: `feat: add activity timing hint`

---

### Task 3: Add a live drag preview that matches the committed drop

**Files:**
- Modify: `src/features/board/dndHandlers.ts`
- Modify: `src/features/board/dndHandlers.test.ts`
- Modify: `src/features/board/dndContext.tsx`
- Modify: `src/features/board/dndContext.test.ts`
- Modify: `src/features/cards/Card.tsx`
- Modify: `src/features/cards/Card.test.tsx`

**Produces:** immediate drag-state timing feedback with live snapped values and stable board geometry.

- [ ] **Step 1: Write failing pure preview tests**

Extract a pure drop plan and prove preview/commit parity:

```ts
const preview = planCardDrop({
  card,
  targetDayKey: '2027-05-02',
  offsetPx: 255,
  dayStart: '06:00',
  dayEnd: '21:00',
  direction: 'down',
})

expect(preview).toEqual({
  dayKey: '2027-05-02',
  startTime: '10:15',
  durationHours: 1,
})
```

Apply the same input to `applyCardDrop` and assert that the document matches the preview while a colliding neighbor stays unchanged.

- [ ] **Step 2: Write failing drag-state component tests**

Test that `SortableCard` replaces the active visual with `EventTimingHint`, preserves the `<li>` height and margin, and exposes no normal card details or resize handles during the active drag.

Test `BoardDnd` state transitions for drag start, move, end, and cancel. A timed card starts with its current timing. An untimed card starts with `null` timing and gains a snapped preview over a day.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```sh
npm test -- src/features/board/dndHandlers.test.ts src/features/board/dndContext.test.ts src/features/cards/Card.test.tsx
```

- [ ] **Step 4: Share one drop plan between preview and commit**

Add the complete pure input and output contract:

```ts
export interface CardDropPlanInput {
  card: Card
  targetDayKey: string
  offsetPx: number
  dayStart: string
  dayEnd: string
  direction: TimeDirection
}

export interface CardDropPlan {
  dayKey: string
  startTime: string
  durationHours: number
}

export function planCardDrop(input: CardDropPlanInput): CardDropPlan
```

Have `applyCardDrop` call `planCardDrop` and commit its result. Preserve `timelineDropOffset` as the coordinate conversion boundary.

- [ ] **Step 5: Track snapped timing during pointer movement**

Add `DragMoveEvent` handling to `BoardDnd`. Resolve the current day body, convert the translated card top with its `scrollTop`, and call `planCardDrop`. Store only the latest `CardDropPlan`.

On drag start, initialize the hint from the timed card or with a null start for an untimed card. On drag end, commit the current pure plan. On cancel, clear all drag state without writing.

- [ ] **Step 6: Render a single moving hint without reflow**

During drag, keep the source `<li>` mounted as an invisible placeholder. Render `EventTimingHint` in `DragOverlay` with the current preview. Do not render both a visible source hint and a visible overlay.

Remove the current `opacity: 0.4` treatment. Keep the same layout height, margin, and dnd transform so starting a drag does not flash, change scroll, or collapse the list.

- [ ] **Step 7: Verify and commit**

Run:

```sh
npm test -- src/features/board/dndHandlers.test.ts src/features/board/dndContext.test.ts src/features/cards/Card.test.tsx
npm run build
```

Commit: `feat: preview activity timing while dragging`

---

### Task 4: Show the same live hint during resizing

**Files:**
- Modify: `src/features/cards/Card.tsx`
- Modify: `src/features/cards/Card.test.tsx`
- Modify: `src/features/board/cardResize.test.ts`

**Produces:** live start, end, and duration feedback for both resize edges.

- [ ] **Step 1: Write failing resize-preview component tests**

Drive the start and end pointer handlers and assert that:

- the normal title, note, category, link, conflict badge, and resize handles disappear immediately;
- `EventTimingHint` uses the initial resize plan on pointer down;
- every snapped pointer move updates start, end, and duration;
- pointer up commits and restores the normal card;
- pointer cancel restores the normal card without committing;
- the `<li>` previews height and top offset without changing its place in the list.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```sh
npm test -- src/features/cards/Card.test.tsx src/features/board/cardResize.test.ts
```

- [ ] **Step 3: Switch the local resize view**

When `resizePreview` is present, render:

```tsx
<EventTimingHint
  startTime={resizePreview.startTime}
  durationHours={resizePreview.durationHours}
/>
```

Otherwise render the normal `Card`. Keep the existing pointer capture, preview geometry, keyboard behavior, and commit threshold. The hint gets no resize controls.

- [ ] **Step 4: Verify and commit**

Run:

```sh
npm test -- src/features/cards/Card.test.tsx src/features/board/cardResize.test.ts
npm run build
```

Commit: `feat: preview activity timing while resizing`

---

### Task 5: Prove the interactions in a real browser

**Files:**
- Modify: `e2e/drag-to-time.spec.ts`
- Modify: `e2e/event-resize.spec.ts`

**Produces:** regression coverage for live hints, overlaps, 15-minute snapping, and viewport stability.

- [ ] **Step 1: Fix the whole-card drag helper**

Replace the obsolete `Drag Stroll` button lookup with the card surface. Keep stepped pointer movement so dnd-kit crosses its activation threshold.

- [ ] **Step 2: Add live drag assertions**

Seed two timed activities. Hold and move the first card onto the second. Before release, assert:

- `event-timing-hint` is visible;
- its start, end, and duration match the snapped pointer position;
- the normal title and resize controls are absent from the moving visual.

After release, assert the moved activity has the previewed start, the second activity retains its exact start, and both show the existing overlap state.

- [ ] **Step 3: Add live resize assertions**

Resize through both the top and bottom handles. While held, assert that the hint updates in 15-minute increments and contains no handles. After release, assert the active activity matches the preview and its neighbor has not moved.

- [ ] **Step 4: Assert viewport stability**

Before each interaction, set horizontal and vertical scroll positions and record the card and board coordinates. Assert after release:

```ts
expect(await board.evaluate((el) => el.scrollLeft)).toBe(beforeScrollLeft)
expect(await page.evaluate(() => window.scrollY)).toBe(beforeWindowScrollY)
```

Also assert that the page did not jump to the top-left during drag activation or release.

- [ ] **Step 5: Run the browser pass**

Run:

```sh
npx playwright test e2e/drag-to-time.spec.ts e2e/event-resize.spec.ts --project=chromium
```

Inspect both interactions in the local browser at desktop and mobile widths. Confirm the pale-blue hint, darker Manrope timing, faint resize hairlines, overlap marker, and unchanged scroll position.

- [ ] **Step 6: Run the full verification suite**

Run:

```sh
npm test
npm run lint
npm run build
npx playwright test --project=chromium
git diff --check
git status --short
```

- [ ] **Step 7: Commit**

Commit: `test: cover activity manipulation feedback`

---

## Acceptance checklist

- [ ] Moving changes only the selected activity.
- [ ] Resizing changes only the selected activity.
- [ ] Moves and resizes overlap instead of pushing.
- [ ] Both interactions snap to 15 minutes.
- [ ] The timing hint appears immediately and updates live.
- [ ] The hint shows only start, end, and duration.
- [ ] The hint matches the approved colors, typography, border, and weight.
- [ ] The hint has no top or bottom resize marks.
- [ ] Normal resize marks are quiet but remain accessible.
- [ ] Release commits the shown values; cancel writes nothing.
- [ ] The board does not flash, reflow, or jump to the top-left.
