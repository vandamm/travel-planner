# Calendar Split Timeline Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real home timeline use the approved Calendar Split design while it loads journeys in the background.

**Architecture:** Keep timeline geometry and date helpers in `yearCalendar.ts`. Refactor only the rendering and local layout calculations in `TimelineHome.tsx`, then remove HomeShell's loading gate so the timeline owns its immediate empty state. The standalone prototype remains a visual reference, not a runtime dependency.

**Tech Stack:** React, TypeScript, Tailwind utility classes, date-fns, Vitest, Testing Library.

## Global Constraints

- Follow [docs/design-handoff-calendar-split-timeline.md](../../design-handoff-calendar-split-timeline.md) exactly; it is the source of truth.
- Modify the real app, not `timeline-holiday-options.html`.
- Preserve date-derived vertical positions via `timelineHeight`; do not add non-date spacing between timeline entries.
- Do not add dependencies, routing, or a production design toggle.
- Keep the home header, Calendar view, hover-to-add-trip affordance, and New Trip modal behaviour intact.
- Use actual trips and school holidays supplied through the existing props; do not add sample data.

---

### Task 1: Cover the timeline composition and immediate rendering

**Files:**
- Modify: `src/features/home/TimelineHome.test.tsx`
- Modify: `src/features/home/HomeShell.tsx`

**Interfaces:**
- Consumes: `TimelineHome({ trips, holidays, onAddTrip })`.
- Produces: a timeline rendered while `loading === true`, plus semantic hooks that assert the real split composition.

- [ ] **Step 1: Write failing component tests**

Add fixtures for a short trip, a three-day trip, a holiday period, and a January boundary. Assert these exact test hooks/text contracts:

```tsx
expect(container.querySelector('[data-timeline-holiday]')).toBeInTheDocument()
expect(container.querySelector('[data-timeline-trip] [data-trip-start-tick]')).toBeInTheDocument()
expect(container.querySelector('[data-timeline-trip] [data-trip-end-tick]')).toBeInTheDocument()
expect(getByText('3 days')).toBeInTheDocument()
expect(queryByText('1 days')).not.toBeInTheDocument()
expect(getByText('2027')).toBeInTheDocument()
```

Mock a pending rooms request in `HomeShell`'s existing test coverage (or add one) and assert `Your travel timeline` and `[data-timeline-canvas]` render before that request resolves; `Loading trips…` must not replace the canvas.

- [ ] **Step 2: Run the focused tests to prove they fail**

Run:

```bash
npm test -- src/features/home/TimelineHome.test.tsx src/features/home/HomeShell.test.tsx
```

Expected: failures for missing split-design hooks/year mark and/or the HomeShell loading gate.

- [ ] **Step 3: Remove the loading gate without changing fetch behaviour**

In the Timeline branch of `HomeShell`, always render:

```tsx
<TimelineHome trips={trips} holidays={holidays} onAddTrip={setCreatingDate} />
```

Delete the timeline-only `loading ? <p>Loading trips…</p> : ...` conditional. Keep `loading` for the Calendar view and keep existing error handling unchanged.

- [ ] **Step 4: Run the focused tests**

Run the command from Step 2. Expected: the immediate-rendering assertion passes; split-composition assertions may remain failing until Task 2.

### Task 2: Render the Calendar Split in the real timeline

**Files:**
- Modify: `src/features/home/TimelineHome.tsx`
- Modify: `src/features/home/TimelineHome.test.tsx`
- Modify: `src/features/home/yearCalendar.ts` only if a small pure formatting helper makes the component simpler; add matching tests in `src/features/home/yearCalendar.test.ts` if changed.

**Interfaces:**
- Consumes: `TimelineHomeProps`, `timelineHeight`, `timelineMonthMarkers`, `tripDurationDays`, and actual date strings.
- Produces: `[data-timeline-holiday]`, `[data-timeline-month]`, `[data-timeline-year]`, `[data-trip-start-tick]`, and `[data-trip-end-tick]` in the real home timeline.

- [ ] **Step 1: Make the component tests pass with the semantic structure**

Render holiday bands in a left-only lane and trip copy in a right-only lane. Use these stable hooks only for tests, not styling:

```tsx
<span data-timeline-holiday ... />
<time data-timeline-month ... />
<time data-timeline-year ...>2027</time>
<span data-trip-start-tick />
<span data-trip-end-tick />
```

For a trip with `const duration = tripDurationDays(trip)`, render the third metadata line only when `duration >= 3`:

```tsx
{duration >= 3 && <span className="...">{duration} days</span>}
```

- [ ] **Step 2: Implement the approved desktop geometry**

In `TimelineHome.tsx`, retain the `left-1/2` rail and use an `18px` gap around it. Position every calendar element with a right edge before the rail and every trip element with a left edge after it. Give month rules an element that starts at the month word and ends before the rail; year rules are 2px. Convert every January marker into its year text with `format(markerDate, 'yyyy')`.

Holiday bands use the actual `[startDate, endDate]` interval, a pale green fill, square corners, no left border, a quiet top/bottom border, and a stronger edge towards the rail. Their date-only label is vertically centred and remains rendered for short periods. Do not render `holiday.name`.

Trip markers use a 14px coloured vertical bar, `minHeight: 16`, a 2px start tick, and a 1px end tick. Centre a long trip's copy at `top + height / 2`; place one- and two-day copy at `top`. Do not introduce diamonds or rounded ribbon caps.

Replace the old start copy and bottom label with:

```tsx
<time ...>{format(todayDate, 'd MMMM yyyy')}</time>
<span className="... today dot ..." />
<time ...>Today</time>
<span className="... end arrow ..." />
```

The end arrow is the final child of the canvas and has no text sibling.

- [ ] **Step 3: Implement narrow-screen restraint**

At the existing small breakpoint, reduce lane widths and utility text sizes, shorten month-rule reach, and hide countdowns before hiding dates. Verify the left calendar/right trip split remains intact and rules leave a gap before the rail.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npm test -- src/features/home/TimelineHome.test.tsx src/features/home/HomeShell.test.tsx src/features/home/yearCalendar.test.ts
npm run build
git diff --check
```

Expected: all selected tests pass, production build succeeds, and `git diff --check` prints no output.

- [ ] **Step 5: Inspect the real local app**

With the existing local Worker and Vite server running, open `http://127.0.0.1:4176/`. Confirm the acceptance checklist in the handoff at desktop and a narrow viewport. If the port differs, use the URL reported by Vite.

- [ ] **Step 6: Commit the implementation**

Run:

```bash
git add src/features/home/TimelineHome.tsx src/features/home/TimelineHome.test.tsx src/features/home/HomeShell.tsx src/features/home/HomeShell.test.tsx src/features/home/yearCalendar.ts src/features/home/yearCalendar.test.ts docs/design-handoff-calendar-split-timeline.md
git add -f docs/superpowers/plans/2026-07-16-calendar-split-timeline-integration.md
git commit -m "feat: integrate calendar split timeline"
```

If a listed test file was not created or modified, omit it from `git add`; do not use `git add -A`.
