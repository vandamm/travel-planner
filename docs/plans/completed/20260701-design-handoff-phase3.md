# Design Handoff — Phase 3: Mobile sheets & scroll affordances

## Overview

Phase 1 established the "ink & type" tokens and restyled the board; Phase 2
extracted the shared `Modal` shell and moved Trip/Cities/Accommodation/Card
editing into it. Phase 3 finishes the **mobile** treatment from the design spec
(`design_handoff_travel_planner/README.md` §8): editors become full-screen
sheets on phones, the single-day timeline gains an overflow scroll affordance,
day navigation gets city-coloured pager dots, and the crowded mobile header
collapses into a `≡` menu.

Scope is exactly §8 minus the items that are their own later phases:
**Share modal, presence avatars/"live" dot, and custom date/time pickers are out
of scope** (native inputs remain; sheets just present them full-screen).

Key benefit: the app becomes genuinely usable on a phone (the current build
renders the desktop-style centered scrim modals and an unbounded timeline on
mobile), while reusing the Phase-2 shell so desktop is untouched.

## Context (from discovery)

- **Files/components involved:**
  - `src/components/Modal.tsx` — shared shell; today a centered scrim card on
    all viewports. Becomes viewport-responsive.
  - `src/features/board/MobileDayView.tsx` — single-day view (swipe + prev/next);
    gains scroll affordance + pager dots.
  - `src/App.tsx` (`Header`/`AppShell`) — inline `[✎ Trip]`/`[◉ Cities]` buttons;
    gains the mobile `≡` menu and lifts an "add stay" trigger to Board.
  - `src/features/board/Board.tsx` — owns the `AccommodationEditor` (`accEditor`
    state) and the existing mobile "Add stay" button; accepts the lifted trigger.
  - Modal consumers whose width class needs an `lg:` prefix so desktop keeps its
    card width: `src/features/cards/CardEditor.tsx`,
    `src/features/accommodation/AccommodationEditor.tsx`,
    `src/features/trip/TripModal.tsx`, `src/features/cities/CityModal.tsx`.
  - `tailwind.config.js` — add a `sheet-in` slide animation (reduced-motion safe).
- **Related patterns found:**
  - `useViewport()` / `LAPTOP_BREAKPOINT = 1024` (`src/features/board/useViewport.ts`)
    — the mobile/desktop split; `1024` == Tailwind `lg`, so the sheet↔scrim switch
    is pure CSS (`lg:` prefixes), no JS branch in `Modal`.
  - `resolveDayCity` + `cityById` (already used in `MobileDayView`/`Board`) resolve
    a day's colour — reused for the active pager dot.
  - `DayColumn` is intentionally pure/shared (desktop + mobile) — the scroll
    affordance lives in `MobileDayView`, NOT in `DayColumn`, so it stays shared.
- **Dependencies identified:** none new. `@dnd-kit`, `date-fns`, Tailwind tokens
  already present. No new npm packages.

## Development Approach

- **Testing approach**: TDD (red-green), per CLAUDE.md. Prefer Playwright e2e
  against the real UI (app is local-first, runs with no backend); reserve Vitest
  for pure logic (overflow-detection helper, pager-dot colour resolution).
- Complete each task fully before moving to the next.
- Make small, focused changes; desktop rendering must not regress.
- **CRITICAL: every task MUST include new/updated tests** for its code changes.
- **CRITICAL: all tests must pass before starting the next task.**
- **CRITICAL: update this plan when scope changes during implementation.**
- Reuse the shared `Modal` shell everywhere (sheets AND the `≡` action menu) — do
  not introduce a parallel `Sheet` component.

## Testing Strategy

- **Unit tests (Vitest)**: pure helpers only — overflow/at-bottom detection,
  active-dot colour resolution, any pure class/label logic. Keep DOM-free.
- **E2E tests (Playwright)**: the mobile behaviours, on the existing phone
  viewport profile (`e2e/mobile.spec.ts` uses `375×667`, `hasTouch`, `isMobile`):
  - editor opens full-screen (sheet) on mobile, centered card on desktop;
  - overflow hint + fade appear only when the timeline overflows, and clear at
    the bottom;
  - pager dots render, mark the current day, and navigate on tap;
  - `≡` menu opens and its items open Trip / Cities / Add-stay sheets.
- Treat e2e with the same rigour as unit tests (must pass before next task).
- Existing e2e (`mobile.spec.ts`, `trip-setup.spec.ts`, `cards.spec.ts`, …) must
  stay green — update selectors only where the DOM legitimately changes.

## Progress Tracking

- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with ➕ prefix; blockers with ⚠️ prefix.
- Keep this plan in sync with actual work.

## What Goes Where

- **Implementation Steps** (`[ ]`): code + tests + docs achievable in this repo.
- **Post-Completion** (no checkboxes): manual device testing and later-phase
  hand-offs (Share/presence/custom pickers).

## Implementation Steps

### Task 1: Make `Modal` a responsive full-screen sheet on mobile
- [x] In `src/components/Modal.tsx`, drive sheet-vs-scrim with Tailwind `lg:`
      classes (no JS branch): base (mobile) = full-screen (backdrop `flex`, card
      `h-full w-full rounded-none` with `sheet-in` slide-up, no width cap →
      max-w-none); `lg:` = today's centered scrim card (`lg:items-center`,
      `lg:justify-center`, `lg:h-auto`, `lg:rounded-frame`, `lg:border`, restore
      `lg:p-4` scrim padding). Keep `role=dialog`/`aria-modal`/`aria-label`/Escape.
      (Kept `max-h-full` unprefixed so the desktop scroll cap is unchanged; width
      is left to the consumer's `w-full lg:max-w-md` so desktop width matches the
      Phase-2 card exactly rather than shrinking to `w-auto`.)
- [x] Add a mobile-only sticky sheet header inside the card: a left-aligned
      back control `‹` (accessible name "Close") that calls `onClose`, hidden on
      `lg:`. Keep each editor's existing in-body `<h2>` as the visible title
      (avoids a 4-file heading refactor; see Technical Details for the trade-off).
- [x] In `tailwind.config.js` add a `sheet-in` keyframe + animation (translateY
      slide-up, 150ms); guard motion so it is disabled under
      `motion-reduce:` (accessibility — do not drop the guard). Also `lg:animate-none`
      so the desktop card never slides.
- [x] Adjust the four consumers' Modal `className` so desktop width survives the
      new mobile-full-screen base: move width to an `lg:` prefix
      (`max-w-md` → `lg:max-w-md`) in `CardEditor.tsx`,
      `AccommodationEditor.tsx`, `TripModal.tsx`, `CityModal.tsx`.
- [x] e2e (`e2e/mobile-sheet.spec.ts`): open the card editor on the mobile
      viewport → dialog fills the viewport (bounding box ≈ viewport) and the `‹`
      close control is visible & closes it; on a desktop viewport the dialog is a
      centered card narrower than the viewport and the `‹` is absent.
- [x] Run `npm test`, `npm run test:e2e`, `npm run lint` — all must pass before Task 2.

### Task 2: Timeline overflow scroll affordance (mobile)
- [x] Add a pure helper (e.g. `src/features/board/scrollHint.ts`) computing hint
      visibility from `{ scrollHeight, clientHeight, scrollTop }` → `showHint`
      (overflowing AND not within an epsilon of the bottom). DOM-free, unit-testable.
- [x] In `MobileDayView.tsx`, wrap the visible day column(s) in a scroll
      container with a bounded max-height (`max-h-[calc(100dvh-12rem)]` — viewport
      minus the pinned header + day-nav/pager), `overflow-y-auto`; keep the
      nav/pager row pinned outside it.
- [x] Overlay a bottom white **fade** gradient + a "scroll for more ↓" hint that
      render only when `showHint` is true (wire an `onScroll` + `useLayoutEffect`
      ref reading the three metrics through the helper; recomputed on
      paging/content/resize). `aria-hidden` on the decorative fade; the hint text
      is not essential content.
- [x] Do NOT touch `DayColumn` (keep it shared/pure) — the affordance is mobile-only.
- [x] Unit tests for the helper (overflowing→true, at-bottom→false, non-overflow→false).
- [x] e2e (`e2e/mobile-scroll-hint.spec.ts`): seed a day with enough cards to
      overflow `375×667` (dev bridge `window.__planner.addCard`) → hint + fade
      visible; scroll to bottom → hint hidden; a short (narrow-window) day → never shown.
- [x] Run `npm test`, `npm run test:e2e`, `npm run lint` — all must pass before Task 3.

### Task 3: City-coloured pager dots (mobile)
- [x] Add a pure helper resolving the **active** day's dot colour via existing
      `resolveDayCity` + `cityById` (fall back to `NO_CITY_COLOR`); unit-testable.
      (`src/features/board/pagerDot.ts` → `dayDotColor`.)
- [x] In `MobileDayView.tsx`, render a dots row (one dot per day; when
      `columns > 1`, one per page) between/below the prev/next controls: active
      dot filled with the day's city colour (inline `style` — the sanctioned
      exception for a city's own colour), inactive dots muted (`bg-edge-300`).
- [x] Make dots real `<button>`s that jump to that day/page; `aria-label`
      "Go to day N" and `aria-current="true"` on the active dot. Keep the
      existing `‹ Prev`/`Next ›` controls (dots augment, not replace).
- [x] Unit test the active-dot colour helper (city hit → its colour; no city →
      `NO_CITY_COLOR`). (`pagerDot.test.ts`; dot rendering covered in `MobileDayView.test.tsx`.)
- [x] e2e: dots count matches day/page count; tapping a dot changes
      `mobile-day-position`; active dot carries `aria-current`. (`e2e/mobile-pager-dots.spec.ts`.)
- [x] Run `npm test`, `npm run test:e2e`, `npm run lint` — all must pass before Task 4.

### Task 4: Mobile `≡` menu (Trip / Cities / Add stay)
- [x] In `App.tsx` `Header`: on mobile hide the inline `[✎ Trip]`/`[◉ Cities]`
      buttons (`lg:` only) and show a `≡` button (accessible name "Menu"). Open a
      menu rendered through the shared `Modal` (so it presents as a bottom/full
      sheet on mobile), listing large tap targets: "Trip setup", "Cities & colours",
      "Add stay". Selecting one closes the menu and opens the corresponding editor.
      (`MobileMenu` component in `App.tsx`, `Modal label="Menu"`.)
- [x] Trip/Cities reuse `AppShell`'s existing `tripOpen`/`citiesOpen` flags.
- [x] Lift the "add stay (create)" trigger: `AppShell` holds an `addStayNonce`
      passed to `Board`; `Board` opens its `accEditor` create mode when the nonce
      changes (keeps `AccommodationEditor` + its board-derived defaults in `Board`).
      Remove the now-redundant standalone mobile "Add stay" header button in
      `Board.tsx` (its role moves into the `≡` menu). Desktop stays lane unchanged.
- [x] e2e: on mobile the inline Trip/Cities buttons are absent and `≡` is present;
      opening `≡` → "Trip setup" opens the Trip sheet, "Cities & colours" opens the
      Cities sheet, "Add stay" opens the Accommodation sheet. On desktop `≡` is
      absent and the inline buttons remain. (`e2e/mobile-menu.spec.ts`.)
- [x] Update `e2e/helpers.ts` if the mobile path to Trip/Cities now goes through
      `≡` (keep desktop helper path intact; branch on viewport if needed).
      (`openEditor` branches on `page.viewportSize()` < 1024.)
- [x] Run `npm test`, `npm run test:e2e`, `npm run lint` — all must pass before Task 5.

### Task 5: Verify acceptance criteria
- [x] Verify every Overview requirement is implemented (sheets, scroll hint,
      pager dots, `≡` menu) and desktop is visually unchanged.
      (All four covered by passing e2e specs — `mobile-sheet`, `mobile-scroll-hint`,
      `mobile-pager-dots`, `mobile-menu` — whose desktop branches assert the
      unchanged scrim card + inline header buttons.)
- [x] Verify edge cases: 1-day trip (no paging, dots = 1), empty timeline (no
      hint), reduced-motion (no slide animation), trip shrinking under the view.
      (Dots derive from `perPage` so 1 day → 1 dot; hint gated on pure
      `showScrollHint` so short/empty day never shows it; `motion-reduce:animate-none`
      guard on the sheet; `safeIndex` clamps a shrunk trip.)
- [x] Run full unit suite (`npm test`) and e2e (`npm run test:e2e`). (343 unit + 26 e2e pass.)
- [x] Run `npm run lint` — all issues fixed. (0 errors; 3 pre-existing fast-refresh warnings.)
- [x] Run `npm run coverage` — maintain the repo's ~90% `src/data`/logic standard.
      (91.02% stmts / 91.7% branch; pure logic modules at/near 100%.)

### Task 6: Update documentation
- [x] Update `CLAUDE.md`: note the responsive `Modal` (sheet on mobile via `lg:`,
      scrim on desktop) and the mobile `≡` menu / lifted add-stay trigger.
      (Modal paragraph in the Styling / design tokens section rewritten.)
- [x] Update `README.md` design section only if a described behaviour changed.
      (Mobile line updated: pager dots, scroll hint, full-screen sheets, `≡` menu.)

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`.*

## Technical Details

- **Sheet via CSS, not JS.** `LAPTOP_BREAKPOINT` (1024) equals Tailwind `lg`, so
  `Modal` needs no `useViewport` call — mobile classes are the base, `lg:` classes
  restore the Phase-2 desktop card. This avoids SSR/hydration mismatch and keeps
  `Modal` free of a `features/board` import.
- **Sheet header trade-off (deliberate simplification).** The spec's mobile sheet
  header is `‹ Title [Save/Done]`. We add only the `‹` close affordance in `Modal`
  and keep each editor's existing in-body `<h2>` as the title and its existing
  bottom Save/Done/Cancel actions. Rationale: no per-editor heading refactor, no
  duplicated title, bottom actions already work. Folding actions into the header
  bar is deferred polish. `// ponytail:` mark this in `Modal.tsx`.
- **Scroll affordance lives in `MobileDayView`,** not `DayColumn`, so the shared
  column stays pure and desktop is unaffected. Hint visibility is a pure function
  of `{scrollHeight, clientHeight, scrollTop}`.
- **Active-dot colour** uses inline `style={{ backgroundColor }}` — the one
  sanctioned inline-hex exception (a city's own colour), consistent with
  `DayColumn`'s `city-band` and `AccommodationBar`.
- **Add-stay lift** uses a nonce (monotonic counter) rather than a boolean, so
  repeated menu taps re-open the editor even without an intervening close.

## Post-Completion

*Items requiring manual intervention or external systems — informational only.*

**Manual verification:**
- Real-device pass on a phone (iOS Safari + Android Chrome): sheet slide-in,
  swipe paging vs. vertical scroll not conflicting, `≡` menu tap targets, fade
  legibility, safe-area/notch insets.
- Landscape phone and small-tablet widths sanity check (full tablet layout is a
  later phase).

**Later phases (explicitly out of scope here):**
- Share modal (§12), presence avatars + "live" dot, custom date/time/color
  pickers (§10/§11), multi-week horizontal-scroll board (§9), tablet layout (§13).
  The `≡` menu is built so Share/presence slot in later without rework.
