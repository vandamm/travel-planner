# Design Handoff — Phase 2: Desktop Modals & Token Cleanup

## Overview

Continue recreating the "Ink & type" hi-fi design
(`design_handoff_travel_planner/`) — **Phase 2, desktop visual completeness
only**: finish the token migration left over from Phase 1, restyle the last
un-restyled modal (the stay editor), and convert the always-visible Trip-setup
and Cities sections into scrim pop-over modals opened from two header buttons.

- **Problem it solves**: Phase 1 restyled the board/card/card-editor/header but
  left three gaps — (1) leftover `slate-*` classes in Board / DayColumn /
  MobileDayView / Accommodation components, (2) the `AccommodationEditor` modal
  still on the old slate skin, and (3) Trip-setup and Cities as inline sections
  rather than the mock's scrim pop-overs.
- **Key benefit**: the desktop app matches the mock end to end, and every modal
  shares one ink-scrim shell (no per-modal drift).
- **Integration**: presentational + light state-lifting only. **No new npm
  deps, no Worker/sync changes, no data-model changes.** Styling stays inline
  Tailwind referencing the Phase-1 tokens in `tailwind.config.js`.

### Scope decisions (confirmed with user)

- **In scope**: slate-* → token cleanup; `AccommodationEditor` ink-scrim
  restyle; Trip-setup & Cities → scrim modals; a shared `Modal` shell.
- **Triggers**: two always-visible header buttons — `[✎ Trip]` and `[◉ Cities]`
  — open the respective modals.
- **Save semantics** (ponytail): keep the current **live writes** through the
  mutators (consistent with the app's local-first CRDT model — every other edit
  writes live and syncs; there is no rollback anywhere). Modals close via a
  single primary button + backdrop + Escape. This deliberately diverges from the
  mock's "Save / Cancel" labels, which are a static-mockup convention; a
  buffered Cancel-with-rollback has no meaning under live sync. Revisit only if
  the user wants true buffered editing.
- **Native pickers stay** (unchanged from Phase 1): keep `<input type=date|time|color>`.
  The custom calendar/wheel/colour pickers remain deferred.

### Explicitly deferred (later phases — do NOT build here)

Custom date/time/colour pickers, share modal, empty/first-run screen, mobile
sheets / pager / hamburger menu, tablet layout, multi-week horizontal-scroll
board, presence avatars / "live" dot.

## Context (from discovery)

- **Reference modal pattern** = `src/features/cards/CardEditor.tsx` (Phase 1):
  scrim `bg-ink/40`, card `rounded-frame border border-ink-frame bg-white p-6
  shadow-xl`, Lora `<h2>`, shared `sectionLabel`/`fieldInput` class strings,
  ink `Save`, vermilion-outline `Delete`, plain `Cancel`. Backdrop-click closes;
  **no Escape handler today** (the new shell adds one).
- **Tokens already exist** (`tailwind.config.js`): `ink`/`ink-{600..200}`,
  `surface`/`surface-chip`, `edge`/`edge-{100,200,300}`, `city-*`, category
  triads, radii `frame/card/chip`. No new tokens needed.
- **Files with leftover `slate-*`** (from the Phase-1 verify pass + Explore):
  - `Board.tsx`: 76 (`text-slate-800`), 87 & 97 (button `border-slate-300
    bg-white text-slate-700 hover:bg-slate-100`), 105 (`text-slate-500`).
  - `DayColumn.tsx`: 41 (`NO_CITY_COLOR = '#cbd5e1'`), 168 (`text-slate-300`
    scale labels), 191 (add-card footer button).
  - `MobileDayView.tsx`: 117 & 129 (prev/next buttons), 121 (`text-slate-600`).
  - `AccommodationLane.tsx`: 113 (gap buttons), 125 (add-stay button).
  - `AccommodationBar.tsx`: 23 (`NO_CITY_COLOR = '#64748b'`).
  - `AccommodationEditor.tsx`: 89 (`bg-slate-900/40` scrim) + labels/inputs/
    buttons — handled wholesale in its restyle task, not the cleanup task.
- **`TripSettings.tsx` and `CityManager.tsx` are already token-styled** (Phase 1
  Task 7) and both write **live** through `setTrip` / `addCity` / `updateCity` /
  `removeCity`. The conversion moves their JSX into modals; the mutator calls
  don't change.
- **Header** (`App.tsx`) is the seal + Lora wordmark + meta line; the two
  trigger buttons go here. `App` currently renders `<TripSettings/>` +
  `<CityManager/>` inline between `<Header/>` and `<Board/>`.
- ⚠️ **e2e ripple**: these specs drive the inline Trip/Cities UI and will break
  once it's behind a modal — they must open the modal first:
  `e2e/trip-setup.spec.ts`, `euro-format.spec.ts`, `drag-to-time.spec.ts`,
  `dnd.spec.ts`, `accommodation.spec.ts` (all fill `Trip title` / `Start date` /
  `Number of days` and/or `New city name` + `Add city`). A shared
  `e2e/helpers.ts` (`setupTrip`, `addCity`) keeps the churn in one place.
- ⚠️ **`accommodation.spec.ts:58,61`** asserts the no-city fallback exactly:
  `rgb(203, 213, 225)` = `#cbd5e1`. Task 1 changes that constant, so this
  assertion must be updated to the new neutral in the **same task**.

## Development Approach

- **Testing approach**: **TDD** (red-green), per CLAUDE.md — failing test first,
  then implement to green.
  - Vitest + Testing Library for the `Modal` shell and each modal/editor
    component (open/close, live write-through, aria).
  - Playwright e2e for the header-button → modal flows and to keep the existing
    board specs green through the inline→modal change.
- Complete each task fully before the next. Small, focused changes.
- **CRITICAL: every task includes new/updated tests as separate checklist items.**
- **CRITICAL: all tests pass before starting the next task.**
- **CRITICAL: update this plan when scope changes during implementation.**
- No data-model / sync changes — this is presentation + state-lifting only.

## Testing Strategy

- **Unit/component**: required every task (see above). Styling-only changes get
  a light targeted assertion (a key element carries the token class, not the old
  `slate-*`), backed by the full suite staying green — not exhaustive
  class-by-class snapshots.
- **E2E (Playwright)**: the inline→modal conversion touches shared setup used by
  many specs. Update the affected specs (listed above) via a shared
  `e2e/helpers.ts` in the same task that moves the UI. Every spec must pass
  before the next task.

## Progress Tracking

- Mark completed items `[x]` immediately.
- New tasks: prefix ➕. Blockers: prefix ⚠️.
- Keep this file in sync with actual work.

## What Goes Where

- **Implementation Steps** (`[ ]`): code, tests, docs — all agent-automatable.
- **Post-Completion** (no checkboxes): manual eyeball vs. the HTML mock, and
  later-phase follow-ups.

## Implementation Steps

### Task 1: Slate-* → token cleanup (board + accommodation lane/bar)
- [x] `DayColumn.test.tsx` / `Board.test.tsx`: assert the retinted elements
  carry token classes (e.g. add-card / add-stay / time-direction buttons use
  `border-edge-300` + `text-ink-600`; scale labels use an ink token) and no
  longer use `slate-*`.
- [x] `Board.tsx`: `text-slate-800`→`text-ink`; button `border-slate-300
  bg-white text-slate-700 hover:bg-slate-100`→`border-edge-300 bg-white
  text-ink-600 hover:bg-surface-chip`; `text-slate-500`→`text-ink-500`.
- [x] `DayColumn.tsx`: scale labels `text-slate-300`→`text-ink-300`; add-card
  footer button → same button token set as above; `NO_CITY_COLOR`
  `#cbd5e1`→a warm neutral (`#c2bba8`, `ink-200`).
- [x] `MobileDayView.tsx`: prev/next buttons → button token set;
  `text-slate-600`→`text-ink-600`.
- [x] `AccommodationLane.tsx`: gap buttons + add-stay button → button/dashed
  token set (`border-edge-300`, `hover:bg-surface-chip`, `text-ink-{500,600}`).
- [x] `AccommodationBar.tsx`: `NO_CITY_COLOR` `#64748b`→the **same** warm neutral
  as DayColumn (`#c2bba8`, ink-200 — identical const in both files).
- [x] ⚠️ update `e2e/accommodation.spec.ts` no-city assertions (lines 39, 58, 61
  and the comments) from `rgb(203, 213, 225)` to `rgb(194, 187, 168)`.
- [x] run tests (`npm test`, `npm run test:e2e`) — 317 unit + 19 e2e pass.

### Task 2: Shared `Modal` shell + AccommodationEditor ink-scrim restyle
- [x] write `Modal` test first (`src/components/Modal.test.tsx`): renders
  children in a `role="dialog"` `aria-modal` with the passed `aria-label`;
  backdrop click and `Escape` both fire `onClose`; a click inside does not.
- [x] add `src/components/Modal.tsx`: the CardEditor scrim shell extracted —
  `fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4` backdrop
  (click→onClose) wrapping a `rounded-frame border border-ink-frame bg-white
  p-6 shadow-xl` card (`stopPropagation`), plus a keydown `Escape`→onClose.
  Props: `{ label, onClose, children, className? }`.
- [x] update `AccommodationEditor.test.tsx`: create/edit/delete still work;
  scrim/heading/inputs/buttons use tokens (no `slate-*`); closes on Escape.
- [x] restyle `AccommodationEditor.tsx`: render through `Modal`; Lora `<h2>`,
  `sectionLabel`/`fieldInput` token strings (mirror CardEditor), ink `Save`,
  vermilion-outline `Delete`, plain `Cancel`. Keep native date/select inputs.
- [x] run tests (unit + `e2e/accommodation.spec.ts`) — 322 unit + 4 e2e pass.

### Task 3: Trip-setup modal + `[✎ Trip]` header trigger
- [x] add `e2e/helpers.ts` with `setupTrip(page, {title, startDate, numDays})`
  and `addCity(page, name)` that open the right modal, fill, and close — then
  point `trip-setup`, `euro-format`, `drag-to-time`, `dnd`, `accommodation`
  specs at the helpers (write/adjust these first; they go red until the UI moves).
  ➕ The Context list under-counted: `day-override`, `card-height`,
  `time-direction`, `cards`, `mobile` also filled the inline trip fields
  directly, so they were routed through `setupTrip` too (full e2e suite stays
  green). `addCity` still fills the inline Cities form; Task 4 updates just the
  helper to open the `[◉ Cities]` modal.
- [x] write `TripModal` test (`src/features/trip/TripModal.test.tsx`): opens from
  the header button; fields write through `setTrip` live; header shows the mock's
  seal + "Trip details" Lora heading; closes via Done/backdrop/Escape. (The
  "opens from header button" assertion lives in `App.test.tsx`; `TripModal.test`
  covers live writes + seal/heading + Done/Escape/backdrop close.)
- [x] add `src/features/trip/TripModal.tsx`: the existing `TripSettings` form
  fields (title / start date + days / day-window start→end) moved into `Modal`,
  styled to the mock (uppercase Manrope labels, Lora values, ink `Done`).
  Keep `setTrip` live writes. Keep native inputs + `lang="de"`. (Field
  accessible labels kept identical to `TripSettings` — "Trip title" / "Start
  date" / "Number of days" / "Day start" / "Day end" — so tests/helpers don't
  churn; visual labels styled via the shared `sectionLabel` uppercase token.)
- [x] `App.tsx`: remove inline `<TripSettings/>`; add a `[✎ Trip]` button in the
  header (token-styled) that opens `TripModal` (local `useState` open flag in a
  new `AppShell` component inside `RoomProvider`). Deleted `TripSettings.tsx` +
  its test (its JSX now lives in `TripModal`) — no dead file.
- [x] update `App.test.tsx`: the `[✎ Trip]` button exists and opens the modal;
  keep seal/wordmark/meta assertions green.
- [x] run tests (unit + affected e2e specs) — 325 unit + 19 e2e pass.

### Task 4: Cities modal + `[◉ Cities]` header trigger
- [x] write `CityModal` test (`src/features/cities/CityModal.test.tsx`): opens
  from the header button; lists city rows (colour dot + name + remove); Add row
  adds a city; edits/removes write live; closes via backdrop/Escape. (The "opens
  from header button" assertion lives in `App.test.tsx`; `CityModal.test` covers
  add/blank-guard/edit/re-roll/remove + Lora heading/no-slate + Escape/backdrop.)
- [x] add `src/features/cities/CityModal.tsx`: the `CityManager` list + add-row
  moved into `Modal`, styled to the mock — "Cities & colours" Lora heading, per
  row a colour swatch (native `<input type=color>`, restyled round-ish) + Lora
  name + remove `×`, dashed divider, "Add a city" row (swatch + input + ink
  `Add`) with the "a colour is picked for you" helper line. Keep live mutators
  + `randomCityColor` re-roll (add-time + a manual ↻ button, per the mock).
  Accessible labels kept identical to `CityManager` ("New city name" / "Name for
  X" / "Colour for X" / "Remove X") so the e2e helper is the only churn.
- [x] `App.tsx`: remove inline `<CityManager/>`; add a `[◉ Cities]` header button
  that opens `CityModal` (second `useState` open flag in `AppShell`). Deleted
  `CityManager.tsx` + its test (folded into `CityModal`), no dead file.
- [x] update `App.test.tsx`: the `[◉ Cities]` button exists and opens the modal.
- [x] update `e2e/helpers.ts` `addCity` to open the `[◉ Cities]` modal, add, and
  close; `trip-setup.spec.ts` reopens the modal for its remove assertion.
- [x] run tests (unit + `e2e/trip-setup.spec.ts`, `accommodation.spec.ts`) —
  329 unit + 19 e2e pass.

### Task 5: Consolidate CardEditor onto the `Modal` shell
- [x] update `CardEditor.test.tsx` if needed: dialog role + `aria-label="Card
  editor"` preserved; add an Escape-closes assertion.
- [x] refactor `CardEditor.tsx` to render its body through `Modal` (drop its
  bespoke scrim/backdrop div; keep all form logic untouched).
- [x] run tests (unit + `e2e/cards.spec.ts`, `card-height.spec.ts`) — 330 unit
  + 2 e2e pass.

*ponytail: Task 5 is pure de-duplication (4th consumer of the shell). If the
retrofit shows any risk to the shipped CardEditor tests, it can be dropped
without affecting Phase-2 goals — CardEditor already looks correct.*

### Task 6: Verify acceptance criteria
- [x] verify Overview requirements: no `slate-*` left in the five cleanup files;
  all four modals share `Modal`; `[✎ Trip]`/`[◉ Cities]` open their scrim
  modals; Trip/Cities no longer render inline. (Modal consumed by CardEditor,
  CityModal, TripModal, AccommodationEditor; App.tsx has both header triggers
  and no inline `<TripSettings/>`/`<CityManager/>`.)
- [x] `grep -rn "slate-" src/` returns only intentional/none — only matches are
  test assertions verifying its **absence** (`.not.toMatch(/slate-/)`); no
  `slate-*` in any component source.
- [x] run full unit/integration suite (`npm test`) — 330 pass.
- [x] run full e2e suite (`npm run test:e2e`) — 19 pass.
- [x] run linter (`npm run lint`) — 0 errors, 3 pre-existing react-refresh
  warnings (RoomProvider, MobileDayView, dndContext — unchanged by Phase 2).
- [x] run `npm run coverage` — 91.02% stmts / 91.66% branch (src/data logic),
  no regression vs. Phase 1.

### Task 7: [Final] Update documentation
- [x] `CLAUDE.md`: note the shared `src/components/Modal.tsx` scrim shell (all
  editors use it) and that Trip-setup / Cities are modal-triggered from the
  header (no longer inline sections).
- [x] `README.md`: update any reference to inline trip/cities setup.

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`.*

## Technical Details

- **`Modal` shell** (`src/components/Modal.tsx`): the only new component. Encodes
  the scrim + centered card + backdrop-close + Escape-close + `role=dialog`/
  `aria-modal`/`aria-label`. Consumed by AccommodationEditor, TripModal,
  CityModal, and (Task 5) CardEditor. Justified over duplication by 4 real
  usages sharing identical shell + close behaviour.
- **State**: `App` holds two local `useState` open flags (`tripOpen`,
  `citiesOpen`); the header buttons set them; the modals clear them on close.
  Doc reads stay via `useRoom()` + `useDocVersion(doc)` as today.
- **No-city neutral**: replace `#cbd5e1` / `#64748b` with one warm neutral
  (recommend `#c2bba8`, `ink-200`); it's a static inline `style` hex (the band /
  bar colour), so it stays a constant, not a class. Calibrate against the mock —
  the value is a tuning knob.
- **Live-write model unchanged**: modals call the same `setTrip` / `addCity` /
  `updateCity` / `removeCity` mutators the inline sections call now; only their
  container and trigger change.

## Post-Completion

*No checkboxes — manual or later-phase.*

**Manual verification**:
- Open `design_handoff_travel_planner/Travel Planner Hi-Fi.dc.html` beside the
  app and eyeball the two pop-overs (Trip details, Cities & colours), the stay
  editor, and the retinted board buttons for colour/type/spacing fidelity.
- Drive the header `[✎ Trip]` / `[◉ Cities]` buttons and Escape/backdrop close.

**Later phases** (not this plan): custom date/time/colour pickers, share modal,
empty/first-run, mobile sheets + pager + menu, tablet, multi-week scroll,
presence avatars / "live" dot.
