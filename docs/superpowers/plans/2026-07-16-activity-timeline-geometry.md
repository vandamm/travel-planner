# Activity Timeline Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render fixed, duration-scaled activity cards on a 60-pixel-per-hour planner timeline.

**Architecture:** Keep timeline math in `cardHeight.ts`. `DayColumn` calculates each list item's exact height and preceding gap, then lets the existing sorted list shift colliding timed cards below the preceding item. `Card` fills the list item. Validation accepts only custom durations of one hour or longer.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Playwright.

## Global Constraints

- Use exactly `60px` per hour, or one pixel per minute.
- Day bodies have fixed heights and scroll when conflict shifting exceeds the time window.
- Cards use exact heights, clip optional overflow, and never use a duration below one hour.
- Preserve the existing reverse-time layout and conflict markers.

---

### Task 1: Define the scale and duration floor

**Files:**
- Modify: `src/features/cards/cardHeight.ts`
- Modify: `src/features/cards/cardHeight.test.ts`
- Modify: `src/data/tripSchema.ts`
- Modify: `src/data/tripSchema.test.ts`
- Modify: `src/data/doc.ts`
- Modify: `src/data/doc.test.ts`

**Interfaces:**
- Produces: `PX_PER_HOUR === 60`; `cardHeightPx(card, dayStart, dayEnd)` returns at least `60` for custom cards.

- [ ] **Step 1: Write failing tests**

```ts
expect(PX_PER_HOUR).toBe(60)
expect(cardHeightPx(card({ durationHours: 1 }), START, END)).toBe(60)
expect(tripDocumentSchema.safeParse({ ...valid, cards: [{ ...card, durationHours: 0.5 }] }).success).toBe(false)
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/features/cards/cardHeight.test.ts src/data/tripSchema.test.ts src/data/doc.test.ts`

- [ ] **Step 3: Implement the smallest shared change**

```ts
export const PX_PER_HOUR = 60
durationHours: z.number().min(1)
return durationHours >= 1 ? durationHours : DEFAULT_CARD_HOURS
```

- [ ] **Step 4: Run focused tests and confirm they pass**

Run: `npm test -- src/features/cards/cardHeight.test.ts src/data/tripSchema.test.ts src/data/doc.test.ts`

### Task 2: Render visible cards on the fixed scale

**Files:**
- Modify: `src/features/board/DayColumn.tsx`
- Modify: `src/features/board/DayColumn.test.tsx`
- Modify: `src/features/cards/Card.tsx`
- Modify: `src/features/cards/CardEditor.tsx`
- Modify: `src/features/cards/CardEditor.test.tsx`

**Interfaces:**
- Consumes: `cardHeightPx`, `windowHeightPx`, and the existing `overlappingCardIds` set.
- Produces: fixed scrolling `day-body` and visible articles whose heights equal card durations.

- [ ] **Step 1: Write failing component tests**

```tsx
expect(screen.getByTestId('day-body')).toHaveStyle({ height: '900px' })
expect(screen.getByText('Dinner').closest('li')).toHaveStyle({ height: '120px' })
expect(screen.getByText('Dinner').closest('[data-testid="card"]')).toHaveClass('h-full', 'overflow-hidden')
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/features/board/DayColumn.test.tsx src/features/cards/CardEditor.test.tsx`

- [ ] **Step 3: Implement the smallest layout change**

```tsx
<div style={{ height: windowHeightPx(dayStart, dayEnd) }} className="... overflow-y-auto">
<ol className="relative flex flex-col pl-0">
<li style={{ height: cardHeightPx(...), paddingTop: gap }}>
<article className="h-full overflow-hidden ...">
```

Set the custom-duration input minimum to `1`.

- [ ] **Step 4: Run focused tests and confirm they pass**

Run: `npm test -- src/features/board/DayColumn.test.tsx src/features/cards/CardEditor.test.tsx`

### Task 3: Prove visible geometry in the browser

**Files:**
- Modify: `e2e/card-height.spec.ts`

**Interfaces:**
- Consumes: visible `[data-testid="card"]` elements inside the planner.
- Produces: a browser regression test that compares activity article boxes and the configured day height.

- [ ] **Step 1: Write the failing browser assertion**

```ts
const defaultBox = await defaultCard.locator('[data-testid="card"]').boundingBox()
const fullBox = await fullCard.locator('[data-testid="card"]').boundingBox()
expect(fullBox!.height).toBeGreaterThan(defaultBox!.height * 10)
```

- [ ] **Step 2: Run the browser test and confirm failure**

Run: `npx playwright test e2e/card-height.spec.ts --project=chromium`

- [ ] **Step 3: Update the test setup for the current trip-settings entry point**

Use the current accessible trip-settings control rather than the removed `Trip` button, then retain the visible-card assertion.

- [ ] **Step 4: Run the browser test and confirm it passes**

Run: `npx playwright test e2e/card-height.spec.ts --project=chromium`

### Task 4: Verify and integrate

**Files:**
- Modify: only files from Tasks 1–3.

- [ ] **Step 1: Run all verification**

Run: `npm test && npm run lint && npm run build && npx playwright test e2e/card-height.spec.ts --project=chromium`

- [ ] **Step 2: Review the final diff**

Run: `git diff --check` and `git diff --stat`.

- [ ] **Step 3: Commit, merge into `main`, and push**

Commit the implementation on `codex/activity-timeline-geometry`, merge it into `main` with a fast-forward merge, and push `main`.
