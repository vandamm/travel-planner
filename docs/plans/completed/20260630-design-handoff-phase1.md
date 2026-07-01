# Design Handoff — Phase 1: Visual Foundation + Board

## Overview

Recreate the "Ink & type" hi-fi design (`design_handoff_travel_planner/`) in the
existing React/TS codebase — **Phase 1 only**: the design-token layer plus the
desktop day board, activity cards, and the two existing editors (Card, Stay).

- **Problem it solves**: the app works but wears a generic slate/system-font
  skin. The handoff specifies a warm-neutral "ink & type" look — Lora + Manrope
  typography, a curated city-hue palette, restyled cards with a NOON divider,
  weekend signalling, category chips, and scrim-styled editor modals.
- **Key benefit**: the app *looks* like the design fast, reusing the current
  component structure and data model (which already matches the handoff's state
  shape). No new screens are built in this phase.
- **Integration**: styling stays Tailwind (extend the theme with tokens); the
  only data-model change is a new `category` enum on `Card`. Everything else is
  presentational.

### Explicitly deferred (later phases — do NOT build here)

Custom calendar & wheel pickers (native inputs stay — the repo deliberately uses
`lang="de"` native pickers), share modal, empty/first-run screen, mobile sheets /
pager / menu, tablet layout, multi-week horizontal-scroll affordances, presence
avatars / "live" dot, converting Trip-setup & Cities from inline sections into
scrim pop-over modals.

## Context (from discovery)

- **Files involved**:
  - Tokens: `tailwind.config.js`, `src/index.css`, `src/main.tsx` (font import),
    `package.json` (add `@fontsource/lora`, `@fontsource/manrope`).
  - Palette: `src/features/cities/colors.ts` (+ `colors.test.ts`).
  - Data model: `src/data/schema.ts`, `src/data/tripSchema.ts`, `src/data/doc.ts`;
    new `src/features/cards/cardCategory.ts`. (`applyTrip.ts` / `exportTrip.ts`
    pass whole card objects through the mutators, so `category` round-trips with
    **no change** to them — only their tests gain a round-trip assertion.)
  - Board UI: `src/features/cards/Card.tsx`, `src/features/cards/CardEditor.tsx`,
    `src/features/board/DayColumn.tsx`, `src/App.tsx` (shell/header).
- **Patterns found**: styling = inline Tailwind classes, no CSS modules; modals
  are `fixed inset-0 … bg-slate-900/40` overlays; cards are a flex list with
  duration-driven `min-height` (`cardHeight.ts`), a left gutter time scale, and
  `time-direction` reversal. `MobileDayView` reuses `DayColumn`, so the board
  restyle flows to mobile for free.
- **Dependencies**: Tailwind 3.4, date-fns 4, dnd-kit, Vitest + Playwright +
  Testing Library already set up.

## Development Approach

- **Testing approach**: **TDD** (red-green) — matches CLAUDE.md. Write the
  failing test first, then implement to green.
  - Vitest for pure `src/data/` logic (schema/zod, mutators, `cardCategory`) and
    a two-`Y.Doc` round-trip for sync-shaped changes.
  - Testing Library component tests for `Card` / `CardEditor` / `DayColumn`.
  - Playwright e2e for board look & behavior (the app is local-first; e2e runs
    with no backend, seeding via `window.__planner`).
- Complete each task fully before the next. Small, focused changes.
- **CRITICAL: every task includes new/updated tests as separate checklist items.**
- **CRITICAL: all tests pass before starting the next task.**
- **CRITICAL: update this plan when scope changes during implementation.**
- Maintain backward compatibility: old synced docs may carry `transport: boolean`
  — keep it valid and render it as a `transit` category (derived, no migration).

## Testing Strategy

- **Unit/component**: required every task (see above).
- **E2E (Playwright)**: this repo has a full e2e suite in `e2e/`. Any board/card
  UI change updates or adds the relevant spec in the same task and it must pass
  before the next task. Watch these existing specs for breakage:
  `cards.spec.ts` (transport chip), `card-height.spec.ts`, `mobile.spec.ts`,
  `smoke.spec.ts`, `euro-format.spec.ts`.

## Progress Tracking

- Mark completed items `[x]` immediately.
- New tasks: prefix ➕. Blockers: prefix ⚠️.
- Keep this file in sync with actual work.

## What Goes Where

- **Implementation Steps** (`[ ]`): code, tests, docs — all agent-automatable.
- **Post-Completion** (no checkboxes): manual visual QA against the HTML mock,
  and later-phase follow-ups.

## Implementation Steps

### Task 1: Design tokens — fonts + Tailwind theme
- [x] add deps `@fontsource/lora` + `@fontsource/manrope`; import the used weights
  in `src/main.tsx` (Lora 500/600/700 incl. italic; Manrope 400/500/600/700/800).
  ponytail: self-hosted via @fontsource, not a Google Fonts `<link>` — this app is
  local-first and must render offline.
- [x] `tailwind.config.js` `theme.extend`: `fontFamily` (`serif: ['Lora', …]`,
  `sans: ['Manrope', …]`); `colors` — ink neutrals (`ink #1f1d18`, `frame #26231d`,
  `#5b554a`, `#8f8775`, `#a8a08d`, `#b3aa96`, `#c2bba8`), surfaces (`#faf8f1`,
  chip-bg `#f0ece2`), borders (`#ddd6c7`, `#e6dfce`, `#ece6d8`, `#cfc9bb`), city
  hues (`vermilion #c0392b`, `pine #5f6f44`, `indigo #3a4a5c`, `plum #8a5a78`),
  and the three category-chip triads (transit `#a8392b`/`#f7e6e2`/`#e7c3bb`,
  outdoor `#4f5e38`/`#edf1e1`/`#d2dcbb`, indoor `#34465a`/`#e6ecf2`/`#cfd9e4`);
  `borderRadius` (frame 5, card 4, chip 3).
- [x] `src/index.css`: set the app base font to Manrope on `body`, ink text color.
- [x] write e2e assertion (`e2e/design-tokens.spec.ts`): a screen title's computed
  `font-family` contains "Lora" and body contains "Manrope".
- [x] run tests (`npm test`, `npm run test:e2e -- design-tokens`) — must pass before Task 2.

### Task 2: City palette → design hues (`colors.ts`)
- [x] update `colors.test.ts` first: assert `CITY_PALETTE` leads with the four
  design hues (vermilion/pine/indigo/plum) and that `randomCityColor` still
  prefers an unused colour.
- [x] replace `CITY_PALETTE` in `src/features/cities/colors.ts` with the curated
  design hues (the 4 named + a few harmonious extras for variety); keep
  `randomCityColor` logic unchanged.
- [x] run tests — must pass before Task 3.

### Task 3: Category data model (`schema.ts` + `tripSchema.ts` + `doc.ts`)
- [x] write tests first: `tripSchema.test.ts` (accepts `category` enum, rejects a
  bad value, still accepts legacy `transport`); `doc.test.ts` (`addCard`/
  `updateCard` persist/clear `category`); a `category` round-trip assertion added
  to `applyTrip.test.ts` **and** `exportTrip.test.ts`; new
  `src/features/cards/cardCategory.test.ts` for the derivation helper.
- [x] `schema.ts`: add `export type CardCategory = 'indoor' | 'outdoor' | 'transit'`
  and `category?: CardCategory` on `Card`; mark `transport?` as legacy in the doc
  comment (kept for back-compat, no removal).
- [x] `tripSchema.ts` `cardSchema`: add `category: z.enum([...]).optional()`; leave
  `transport` optional.
- [x] `doc.ts`: add `category?` to `NewCard` and spread it in `addCard`
  (`updateCard` already patches arbitrary fields).
- [x] add `src/features/cards/cardCategory.ts`:
  `cardCategory(card) = card.category ?? (card.transport ? 'transit' : undefined)`.
  ponytail: derive legacy `transport:true` as `transit` at read time — no bulk
  CRDT data migration; the editor rewrites to `category` (and drops `transport`)
  on the card's next save.
- [x] run tests — must pass before Task 4.

### Task 4: Activity card restyle (`Card.tsx`)
- [x] update `Card.test.tsx` first: a category chip renders per `category`
  (indoor/outdoor/transit) using `cardCategory`; a legacy `transport:true` card
  shows the transit chip; note/link/safe-href behavior unchanged.
- [x] restyle `Card.tsx`: `#faf8f1` fill, `#e6dfce` border, card radius; Lora
  title, Manrope meta; time range right-aligned; category chip (Manrope 9.5/700
  UPPERCASE, chip-triad colors) replacing the `🚆` emoji; keep drag handle, note,
  and the http(s)-only link guard. Keep `data-testid="card"`.
- [x] run tests (unit + `e2e/cards.spec.ts`, `card-height.spec.ts`) — pass before Task 5.

### Task 5: Card editor restyle — segmented Type + Card size + scrim (`CardEditor.tsx`)
- [x] update `CardEditor.test.tsx` first: selecting a Type segment saves
  `category`; editing a legacy `transport` card pre-selects Transit and saving
  clears `transport`; the Card-size segment saves `size`; delete/save unchanged.
- [x] replace the "This is transportation" checkbox with a **Type** segmented
  control (Indoor / Outdoor / Transit; selected = filled chip color) that writes
  `category` and sets `transport: undefined` on save.
- [x] replace the Height `<select>` with a **Card size** segmented control
  (Auto = ink fill / Small / Half day / Whole day).
- [x] Start → End as two equal-width centred fields; keep the native `type="time"`
  `lang="de"` inputs (custom wheel picker is deferred — see Overview).
- [x] restyle the modal to the ink scrim + Lora heading, ink Save button,
  vermilion-outline Delete.
- [x] run tests (unit + `e2e/cards.spec.ts`) — pass before Task 6.

### Task 6: Day column restyle (`DayColumn.tsx`)
- [x] update `DayColumn.test.tsx` first: weekend weekday label is bold-vermilion;
  **no** column background tint (drop `bg-rose-50`); a 3px city-colour header
  underline is present; a NOON divider renders in the body.
- [x] header: Manrope tracked weekday label above a Lora city name; replace the
  top `city-band` with a **3px city-colour bottom underline** under the header;
  keep the `▾` city-override select and override indicator.
- [x] weekend: bold vermilion weekday label (weekdays stay muted `#a8a08d`);
  remove the `bg-rose-50` weekend background (design decided against tints).
- [x] body: add a labelled **NOON** hairline across the body at the noon fraction
  of the `dayStart`–`dayEnd` window, respecting time-direction.
  ponytail: NOON is a positional hairline, not a data zone — no per-card `zone`
  field; cards keep sorting via `cardSort`, so dnd/sort are untouched.
- [x] run tests (unit + `e2e/smoke.spec.ts`, `mobile.spec.ts`) — pass before Task 7.

### Task 7: App shell / header visual pass (`App.tsx`)
- [x] restyle the header to the "ink & type" look: vermilion **seal** (square,
  Lora italic "I") + Lora wordmark from the trip title + the meta line; apply
  tokens/fonts to the existing inline TripSettings & CityManager sections
  (restyle only — they stay inline sections this phase, not modals).
- [x] update `App.test.tsx` for the wordmark/seal; keep existing assertions green.
  ponytail: avatars, "live" dot, "+ add stay" chrome, and share are deferred.
- [x] run tests — must pass before Task 8.

### Task 8: Verify acceptance criteria
- [x] verify Overview requirements are implemented (tokens, palette, category,
  card, editor, day column, header). — confirmed in tailwind.config.js (fonts,
  city hues, category triads), colors.ts, schema/tripSchema/doc + cardCategory.ts,
  Card/CardEditor/DayColumn/App restyles; all backed by passing tests.
- [x] run full unit/integration suite (`npm test`) — 314 passed (32 files).
- [x] run full e2e suite (`npm run test:e2e`) — 19 passed.
- [x] run linter (`npm run lint`) — 0 errors (3 pre-existing react-refresh
  warnings in untouched files: RoomProvider/MobileDayView/dndContext).
- [x] run `npm run coverage` — 91% stmts/branches on the `src/data/**` bar
  modules; no threshold configured to fail.

### Task 9: [Final] Update documentation
- [x] `CLAUDE.md`: document the new `Card.category` enum (and `transport` as
  legacy/derived), the design-token palette in `colors.ts`, and the self-hosted
  Lora/Manrope fonts. — added category+cardCategory to "Card ordering" and a new
  "Styling / design tokens" section (tailwind tokens, self-hosted @fontsource,
  CITY_PALETTE).
- [x] `README.md`: note the design tokens / fonts only if it references styling.
  — refreshed the stale card/weekend styling bullet (category chip; weekend =
  vermilion label, no tint) and added ink & type tokens + self-hosted fonts to
  the Tech stack.

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`.*

## Technical Details

- **`Card` additions**: `category?: 'indoor' | 'outdoor' | 'transit'`. `transport?`
  retained for back-compat. Derivation: `cardCategory(card) = card.category ??
  (card.transport ? 'transit' : undefined)`.
- **Round-trip**: `applyTrip` re-adds cards via `addCard(doc, card)` and
  `exportTrip` serializes via `listCards().toJSON()`, so `category` flows through
  both once it's in `NewCard`/`addCard` + `cardSchema` — no edits to those two
  files, only added test assertions.
- **Token source**: all colours/fonts/radii live in `tailwind.config.js` +
  `index.css`; components reference token class names, never re-state hexes
  inline (except existing dynamic `style={{ backgroundColor: city.color }}`).
- **NOON position** = `(('12:00' − dayStart) / (dayEnd − dayStart))` of the body
  height; reuse the minute math already in `cardHeight.ts` rather than duplicating.

## Post-Completion

*No checkboxes — manual or later-phase.*

**Manual verification**:
- Open `design_handoff_travel_planner/Travel Planner Hi-Fi.dc.html` beside the app
  and eyeball the desktop board, activity card, card editor, and day header for
  pixel-fidelity (colours, type scale, spacing, radii).

**Later phases** (not this plan): custom date/time pickers, share modal,
empty/first-run, full mobile sheets + pager + menu, tablet, multi-week scroll
affordances, presence avatars / "live", and Trip-setup/Cities as scrim modals.
