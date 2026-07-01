# Design Handoff — Phase 4: Multi-week board & custom pickers

## Overview

Phases 1–3 delivered design-spec §1–8 (ink & type tokens, the desktop board and
pop-overs, and the full mobile treatment — sheets, scroll hint, pager dots, ≡
menu). Phase 4 finishes the remaining desktop/mobile screens from the spec
(`design_handoff_travel_planner/README.md`):

- **§9 Full trip board (multi-week)** — the desktop columns row already scrolls
  horizontally; add the affordances that make a long trip navigable: a right-edge
  fade, a "Jump to today" control, and a date-range stepper.
- **§10 Date picker** — a custom calendar pop-over (single date for trip start;
  first→last **range** for stays) replacing the native `<input type="date">`.
- **§11 Time picker** — a custom hour/minute wheel pop-over replacing the native
  `<input type="time">`.

**Explicitly OUT of scope this phase (owner decisions):**
- **§12 Share the trip** — **postponed until after the agent-induced changes**
  (`docs/plans/20260701-agent-board-self-discovery.md`) land. That work may change
  the *shape* of the share link itself (e.g. a per-room write token in the hash,
  `#room=abc&k=<token>`) and the auth posture behind it, so building the "Invite a
  travel buddy" modal now risks reworking it. Ship Share once the link/auth
  contract is settled — see Later phases.
- **§13 Tablet (landscape)** — dropped. The app stays a binary
  mobile(<1024)/desktop(≥1024) split; no tablet category, no tablet-driven column
  reflow. `useViewport.ts` is **not** touched.
- **Presence** (stacked avatars, pine "live" dot, "N editing now") — deferred to a
  later phase; it needs Liveblocks *awareness* wiring and a live backend to verify.
  It rides in with §12 Share (footer) and the §9 toolbar when those land.

Key benefit: long trips become navigable on desktop and date/time entry matches
the designed pop-overs — all reusing existing infrastructure (the `Modal` shell,
`date-fns`, the doc mutators) with **no new npm dependencies**.

## Context (from discovery)

- **§9 — files:** `src/features/board/Board.tsx` (desktop path ~L131–162 is a
  `flex gap-3 overflow-x-auto` row; **it already scrolls horizontally**),
  `src/features/board/DayColumn.tsx` (fixed `w-56` = 224px column),
  `src/features/accommodation/AccommodationLane.tsx` (CSS grid
  `repeat(days.length, 14rem)`, `columnGap: 0.75rem` — **already aligned** to the
  columns, inside the same scroll container). No desktop scroll affordance,
  jump-to-today, or date-range stepper exists today. The column width lives in
  three places (`DayColumn` `w-56`, `AccommodationLane` `14rem`,
  `useViewport.ts` `COLUMN_WIDTH_PX = 224`) — see Technical Details.
- **§10 — files:** native date inputs at `TripModal.tsx:54` (start date) and
  `AccommodationEditor.tsx:134,147` (first/last night, chained via `showPicker()`
  at L61). No calendar/month-grid component exists. `date-fns@^4.1.0` is installed.
  `src/data/dateFormat.ts` formats stored ISO dates for display (European `dd.MM`);
  `src/data/days.ts` generates the trip day array.
- **§11 — files:** native time inputs at `TripModal.tsx:82–99` (dayStart/dayEnd)
  and `CardEditor.tsx:206,219` (start/end, rendered only when `timed`). No custom
  time UI exists.
- **§12 (deferred — see scope above; kept for when Share lands) — files:** `src/data/provider.ts` has `roomIdFromHash` (L27–35) and
  `roomHash(roomId)` (L37–40, builds `#room=<id>`). **No share/copy-link UI
  exists.** Liveblocks is wired (`provider.ts` L161–190) but **no presence/awareness
  API is used**. **No read-only vs. edit distinction** — every client is an editor.
- **Modal / pop-over infra:** `src/components/Modal.tsx` is a full-screen sheet on
  mobile / centered scrim card on desktop (Phase 3). It is **not** anchored to a
  trigger. The §10/§11 pickers are *anchored* pop-overs → a small anchored
  primitive is needed (see Task 1). The §12 Share modal reuses `Modal` as-is.
- **Triggers:** desktop editors open from header buttons (`App.tsx` `Header`);
  mobile opens them from the `≡` menu (`MobileMenu` in `App.tsx`, via
  `tripOpen`/`citiesOpen` flags + the `addStayNonce` lift). Share follows the same
  two-path pattern (Task 5).
- **Dependencies identified:** none new. `date-fns`, the `Modal` shell, `roomHash`,
  and the doc mutators already exist.

## Development Approach

- **Testing approach**: **TDD (red-green)**, per CLAUDE.md. Playwright e2e against
  the real UI (local-first, no backend) for behaviours; Vitest for pure logic
  (month-grid generation, range selection, wheel value lists, jump-to-today target,
  horizontal scroll-hint).
- Complete each task fully before the next; small, focused changes.
- **CRITICAL: every task MUST include new/updated tests.**
- **CRITICAL: all tests pass before starting the next task.**
- **CRITICAL: update this plan when scope changes during implementation.**
- **Desktop rendering from Phases 1–3 must not regress** (mobile sheets, ≡ menu,
  pager dots, scroll hint stay green).
- Reuse existing infra: the shared `Modal` for the Share modal; `date-fns` (already
  installed) for calendar math; the doc mutators for all writes; keep stored values
  ISO and only the *display* European (CLAUDE.md rule). **No new npm packages.**

## Testing Strategy

- **Unit tests (Vitest)** — pure helpers only, DOM-free:
  - month-grid generation (weeks × 7, leading/trailing days, week starts Sunday
    per the `S M T W T F S` spec row);
  - date-range selection reducer (pick first → pick last; last-before-first swaps;
    single-date mode);
  - wheel value lists + snap (hours 00–23, minutes 00–59) and HH:mm parse/format;
  - "jump to today" target resolution (today within trip → its index; outside →
    clamp/none) and any horizontal scroll-hint helper.
- **E2E tests (Playwright)** — desktop viewport for §9/§10/§11 desktop pop-overs,
  the existing `375×667` phone profile for the mobile paths:
  - §9: a 14-day trip shows the right-edge fade + scroll track; "Jump to today"
    scrolls today's column into view; the range stepper pages the scroll.
  - §10: opening the calendar from trip start picks a date (board rebuilds);
    opening it from a stay picks a first→last **range** (endpoints highlighted).
  - §11: opening the wheel from a card sets start/end; "Clear" untimes.
- Treat e2e with the same rigour as unit tests (must pass before next task).
- Existing e2e (`mobile-*.spec.ts`, `trip-setup.spec.ts`, `cards.spec.ts`, …) must
  stay green — update selectors only where the DOM legitimately changes (the
  native date/time inputs become custom triggers; `e2e/helpers.ts` may need the
  new picker flow).

## Progress Tracking

- Mark completed items `[x]` immediately when done.
- New tasks get a ➕ prefix; blockers a ⚠️ prefix.
- Keep this plan in sync with actual work.

## What Goes Where

- **Implementation Steps** (`[ ]`): code + tests + docs achievable in this repo.
- **Post-Completion** (no checkboxes): manual device/browser passes and later-phase
  hand-offs (presence, tablet, §13).

## Implementation Steps

### Task 1: Anchored pop-over primitive (shared by §10 + §11)
- [x] Add `src/components/Popover.tsx` — a small anchored floating panel (trigger
      + content) with click-outside + Escape close, `role="dialog"`/`aria-label`,
      and reduced-motion-safe reveal. **No positioning library** — CSS
      absolute/`relative` anchoring below the trigger; on the mobile viewport it
      may fall back to the existing `Modal` sheet (reuse, don't reinvent).
      (`// ponytail:` justified by two real consumers — date + time pickers; not
      speculative. Keep it minimal.) → `fixed`-positioned panel via pure
      `popoverPosition` helper; mobile falls back to `Modal`; `popover-in`
      keyframe added to `tailwind.config.js` (motion-reduce guarded).
- [x] Extract only what both pickers need; no props "for later". → render-prop
      `children(close)` + `trigger`/`triggerClassName`/`triggerAriaLabel`/`label`
      only; self-managed open state, no controlled-open/placement props.
- [x] write unit tests for any pure open/close/position helper (success + edge:
      trigger near viewport edge clamps in-view). → `popoverPosition.test.ts`
      (6 cases: below-align, right/left/wide clamp, flip-above, nearest-edge).
- [x] write e2e: popover opens on trigger click, closes on outside-click and Esc,
      is focus-trapped/labelled. → covered now by the jsdom component test
      `Popover.test.tsx` (open/Esc/outside-click/focus-in/focus-restore/labelled);
      real-browser e2e lands via its first consumers (DatePicker Task 2,
      TimePicker Task 3) since no standalone Popover route exists yet.
- [x] run `npm test`, `npm run test:e2e`, `npm run lint` — all pass before Task 2.
      → 355 unit + 27 e2e pass; lint 0 errors.

### Task 2: §10 Date picker (calendar pop-over, single + range)
- [x] Add a pure `monthGrid(year, month)` + range-selection reducer (e.g.
      `src/features/pickers/calendar.ts`) using `date-fns`; weeks start Sunday
      (`S M T W T F S`). Single-date mode (trip start) and range mode
      (stay first→last, last-before-first swaps). Stored/returned values stay ISO
      `YYYY-MM-DD`; display is European. → `src/features/pickers/calendar.ts`
      (`monthGrid`, `nextRange` swap-reducer, `inRange`/`isEndpoint`); ISO string
      compare is chronological so range math needs no Date parsing.
- [x] Add `DatePicker` calendar UI (month header `‹ May 2027 ›`, weekday row, 7-col
      grid) inside the Task-1 `Popover`; range endpoints filled vermilion, between
      soft-tinted (design tokens, not inline hex where a token exists). →
      `src/features/pickers/DatePicker.tsx`; endpoints `bg-city-vermilion`, between
      `bg-transit-bg`; adjacent-month days are muted non-buttons. Trigger display
      via new `formatDayLong` (`dd.MM.yyyy`) / `formatDay` range.
- [x] Replace the native start-date input in `TripModal.tsx` with the calendar
      trigger (writes via `setTrip`); replace the two native night inputs in
      `AccommodationEditor.tsx` with a single range calendar (writes first→last).
      Keep ISO storage + European display; writes go through the doc mutators only.
      → removed the `showPicker` chaining + `rangeInvalid` alert (the reducer swaps,
      so an inverted range can't occur).
- [x] write unit tests: `monthGrid` (row/col counts, leading/trailing days, leap
      Feb, month boundaries); range reducer (first→last, swap, single-date, clear).
      → `calendar.test.ts` (14 cases); updated `TripModal`/`AccommodationEditor`
      component tests + `formatDayLong` in `dateFormat.test.ts`.
- [x] write e2e: pick trip start via calendar → board rebuilds to that date; pick a
      stay range → endpoints highlighted, stay bar spans the nights. →
      `e2e/date-picker.spec.ts` (single rebuild + range endpoint highlight).
- [x] update `e2e/helpers.ts` if `setupTrip`/stay setup now goes through the
      calendar instead of a native input (branch as needed; keep desktop+mobile).
      → added `pickDate`/`pickRange` (month-step via `data-month`, click `data-key`);
      `setupTrip` + `accommodation.spec.ts` migrated; works desktop + mobile sheet.
- [x] run `npm test`, `npm run test:e2e`, `npm run lint` — all pass before Task 3.
      → 371 unit + 29 e2e pass; lint 0 errors.

### Task 3: §11 Time picker (hour/minute wheel pop-over)
- [x] Add pure helpers (`src/features/pickers/timeWheel.ts`): hour list (00–23),
      minute list (00–59), HH:mm parse/format, nearest-snap. DOM-free, unit-tested.
      → `HOURS`/`MINUTES` (index === value), `parseTime` (null on empty/OOR),
      `formatTime` (snaps then pads), `snapTime` (clamp+round to nearest valid cell).
- [x] Add `TimePicker` UI (hour column · `:` · minute column, centred selection
      band per spec; footer "Set HH:mm" + "Clear") inside the Task-1 `Popover`.
      Clearing an activity's start/end = untimed (patch `undefined`, per doc.ts
      clear-semantics). → `src/features/pickers/TimePicker.tsx`; two `role=listbox`
      columns, selected cell `bg-city-vermilion` + jsdom-safe
      `scrollIntoView({block:'center'})`; `Clear` shown only when `onClear` is
      passed (required trip-window fields have none). Consumer maps the empty
      commit to `''` → `undefined` on save.
- [x] Replace native time inputs: `TripModal.tsx` dayStart/dayEnd and
      `CardEditor.tsx` start/end. Keep HH:mm storage; writes via the mutators.
      → CardEditor start/end pass `onClear={() => setStart/End('')}`; the trip
      window has no Clear. Header comments updated (no longer native inputs).
- [x] write unit tests: value lists, parse/format round-trip, snap, clear→undefined.
      → `timeWheel.test.ts` (10), `TimePicker.test.tsx` (5); updated `TripModal`
      (day-window via wheel) + `CardEditor` tests (`setTimeViaWheel` helper +
      a Clear-untimes case).
- [x] write e2e: set a card start+end via the wheel → card height reflects it;
      Clear → card untimes; set the trip day window via the wheel.
      → `e2e/time-picker.spec.ts` (3 tests) + `pickTime` in `e2e/helpers.ts`;
      `cards.spec.ts` migrated off the native input. Card height is derived and
      unit-tested in `cardHeight.test.ts`; the e2e proves the wheel writes/clears
      the stored HH:mm (range renders `10:00–12:30`).
- [x] run `npm test`, `npm run test:e2e`, `npm run lint` — all pass before Task 4.
      → 387 unit + 32 e2e pass; lint 0 errors.

### Task 4: §9 Multi-week board affordances (desktop)
- [x] The desktop columns row already scrolls (`Board.tsx` `overflow-x-auto`).
      Add a **right-edge white fade** gradient shown only while more columns lie
      off-screen to the right (`aria-hidden` decorative; mirror the Phase-3 mobile
      vertical fade approach), and a thin **horizontal scroll track/thumb** if a
      pure indicator is cheap (else rely on the native scrollbar + fade).
      → `board-fade` overlay (`bg-gradient-to-l from-white`) gated by pure
      `showRightFade({scrollWidth,clientWidth,scrollLeft})`; scroll container
      wrapped in a `relative` div. No custom track — native scrollbar + fade
      (the fade is the cheap indicator; a custom thumb was speculative).
- [x] Add a **"Jump to today"** button (desktop toolbar) that scrolls today's
      column into view; disabled/absent when today is outside the trip range.
      Back it with a pure target-index helper (`src/features/board/jumpToToday.ts`
      or reuse `days.ts`), unit-tested.
      → `todayIndex(days, toDayKey(new Date()))` in `multiWeekNav.ts`; button
      absent when `< 0`; click `scrollTo({left: idx*COLUMN_STRIDE_PX})`.
- [x] Add a **date-range stepper** (`‹ Apr 30 – May 13 ›`) in the desktop toolbar
      showing the visible date span; prev/next page the horizontal scroll by a
      viewport-width of columns. Keep the label derivation pure/tested.
      (`// ponytail:` lean version — page-by-viewport scroll, not a virtualized
      week grid; upgrade only if long-trip perf demands it.)
      → `visibleRange`/`rangeLabel` (European `dd.MM` via `formatDay`); `‹`/`›`
      `scrollBy({left: ±clientWidth})`; label recomputes on scroll + resize.
- [x] Do NOT change the mobile single-day view or `useViewport.ts` (tablet is out
      of scope; the mobile/desktop split is unchanged). → both untouched; the new
      toolbar controls are gated behind `viewport === 'desktop'`.
- [x] write unit tests: jump-to-today target (inside/outside trip → index/none);
      visible-range label; horizontal scroll-hint visibility from
      `{scrollWidth, clientWidth, scrollLeft}`. → `multiWeekNav.test.ts` (14 cases).
- [x] write e2e (desktop viewport): 14-day trip → right fade visible, clears when
      scrolled fully right; "Jump to today" brings today's column into view; the
      stepper pages the scroll and updates its label. Short trip (fits) → no fade.
      → `e2e/board-multiweek.spec.ts` (5 tests; "today" anchored to the browser
      clock so the component's `new Date()` matches).
- [x] run `npm test`, `npm run test:e2e`, `npm run lint` — all pass before Task 5.
      → 401 unit + 37 e2e pass; lint 0 errors; `tsc` clean.

### Task 5: Verify acceptance criteria
- [x] Verify each in-scope Overview requirement is implemented (§9 affordances,
      §10 calendar single+range, §11 wheel) and Phases 1–3 are
      visually unchanged (mobile sheets, ≡ menu, pager dots, scroll hint).
      → §9/§10/§11 covered by `board-multiweek`, `date-picker`, `time-picker`
      e2e; Phases 1–3 behaviourally intact — `mobile-sheet`, `mobile-menu`,
      `mobile-pager-dots`, `mobile-scroll-hint` e2e all green. (Pure-visual
      regression is the manual real-browser pass under Post-Completion.)
- [x] Verify edge cases: today outside the trip (no/disabled Jump-to-today);
      1-day trip and short trips (no horizontal fade); stay range where last <
      first (swaps); clearing a card time (untimes); reduced-motion (no picker/
      sheet animation). → `multiWeekNav.test.ts` (today-outside → `todayIndex<0`,
      no button; `showRightFade` false when it fits), `calendar.test.ts`
      (last-before-first swap), `timeWheel`/`TimePicker`/`CardEditor` tests
      (clear→`undefined`→untimes); reduced-motion `motion-reduce`-guarded in
      `Popover`/`Modal`/keyframes.
- [x] Run full unit suite (`npm test`) and e2e (`npm run test:e2e`).
      → 401 unit pass; 37 e2e pass.
- [x] Run `npm run lint` — all issues fixed. → 0 errors (3 pre-existing
      react-refresh warnings, unrelated to Phase 4).
- [x] Run `npm run coverage` — maintain the repo's ~90% `src/data`/logic standard
      (pure picker/board helpers at/near 100%). → `src/data` 91.07% lines
      (coverage `include` is scoped to `src/data/**/*.ts`); picker/board pure
      helpers each carry a dedicated unit suite (calendar 14, timeWheel 10,
      multiWeekNav 14, popoverPosition 6).

### Task 6: Update documentation
- [x] Update `CLAUDE.md`: note the custom date/time pickers (replacing native
      inputs; ISO storage / European display preserved), the anchored `Popover`
      primitive vs. the centered/sheet `Modal`, and the desktop multi-week
      affordances. → Styling section gains a `Popover` (anchored, `popoverPosition`,
      mobile→`Modal`) paragraph, a custom-pickers block (`DatePicker`/`calendar.ts`
      single+range, `TimePicker`/`timeWheel.ts`, `Clear`→`undefined`), and a
      `multiWeekNav.ts` affordances block; the shared-modules `dateFormat.ts` note
      adds `formatDayLong` and drops the stale "native picker widgets follow the OS
      locale" line.
- [x] Update `README.md` design section for the behaviours that changed
      (multi-week navigation, pickers). → board bullet gains desktop
      horizontal-scroll fade + Jump-to-today + range stepper; dates/times bullet
      replaced "native picker widgets follow the OS locale" with the app's own
      calendar/wheel pickers (anchored desktop / sheet mobile).

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`.*

## Technical Details

- **§9 is mostly done already.** The desktop board is a `flex gap-3
  overflow-x-auto` row (`Board.tsx`), so horizontal scroll for 14+ days already
  works; `AccommodationLane` uses a matching CSS grid inside the same scroll
  container, so the stays lane scrolls in lockstep. Phase 4 adds only the
  *affordances* (fade, scroll track, Jump-to-today, range stepper) — not new
  layout. Deliberately **not** narrowing the ~224px column to the spec's ~150px:
  with tablet out of scope the only reason to narrow (fit ~5 columns at tablet
  width) is gone, and narrowing would restyle the Phase-1 desktop hero. Leave the
  column width alone; if the owner later wants the ~150px multi-week density, it's
  a one-line change at the single width source below.
- **Single column-width source (if ever narrowed).** Width is stated in three
  places today — `DayColumn` `w-56`, `AccommodationLane` `repeat(_, 14rem)`, and
  the numeric source `useViewport.ts` `COLUMN_WIDTH_PX = 224`/`COLUMN_GAP_PX = 12`.
  Task 4's `multiWeekNav.ts` scroll stride is **not** a fourth copy — it derives
  `COLUMN_STRIDE_PX = COLUMN_WIDTH_PX + COLUMN_GAP_PX` from that source. Any width
  change must still update the two Tailwind class strings (`w-56`, `14rem`) so the
  lane and columns can't drift; fully unifying those behind one token is not needed
  this phase.
- **Pickers: anchored pop-over, not `Modal`.** `Modal` is centered/full-screen —
  wrong for a field dropdown. Task 1's `Popover` anchors to the trigger; on mobile
  it may reuse the `Modal` sheet. Justified by two consumers (date + time), each
  used in 2–3 sites — extraction, not speculation.
- **Storage invariants preserved.** Custom pickers must keep values ISO
  (`YYYY-MM-DD`) / `HH:mm` and render European only — same rule the native
  inputs followed. All writes go through the doc mutators (`setTrip`,
  `updateCard`, `updateAccommodation`), never poking `Y.Map`s.
- **No new dependencies.** Calendar math from `date-fns` (installed); pickers,
  the popover, and the scroll fade are hand-rolled from existing tokens and
  primitives.

## Post-Completion

*Items requiring manual intervention or external systems — informational only.*

**Manual verification:**
- Real-browser pass on desktop (Chrome/Firefox/Safari): horizontal scroll + fade
  legibility, Jump-to-today, range stepper paging; calendar range highlight;
  time-wheel snap feel.
- Phone pass: pickers presented as full-screen sheets.

**Later phases (explicitly out of scope here):**
- **§12 Share the trip** — the "Invite a travel buddy" modal (read-only link field
  + Copy, reusing `roomHash` + the shared `Modal`, triggered from the desktop
  toolbar and the mobile ≡ menu). **Sequenced after** the agent-induced changes
  (`docs/plans/20260701-agent-board-self-discovery.md`), because that work may
  reshape the share link (per-room write token) and the auth posture the modal
  surfaces — build it once, against the settled contract.
- **Presence** — stacked avatars, pine "live" dot, "N editing now" (Liveblocks
  awareness) in the §9 toolbar and the §12 Share footer, plus a functional
  "anyone can edit" toggle (needs a read-only capability first).
- **§13 Tablet (landscape)** — a dedicated tablet reflow (~5 flexible columns, no
  scroll). Deferred; the app stays binary mobile/desktop for now.
