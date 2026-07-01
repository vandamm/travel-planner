# CLAUDE.md

Conventions for working in this repo. Read this before touching the data model.

## What this app is

A local-first, collaborative day-board for planning a trip. The SPA
(Vite + React + TS, Cloudflare Pages) renders and edits on local IndexedDB and
syncs in the background via Liveblocks + Yjs. A single Cloudflare Worker
(`worker/`) holds the secrets, mints tokens, gates room creation, and exposes the
agent HTTP API. See `README.md` for the overview and `docs/` for the schema and
deployment.

## The Yjs doc is the single source of truth

Everything persistent lives on one shared `Y.Doc`. Top-level containers:

| Container | Yjs type | Holds |
| --- | --- | --- |
| `trip` | `Y.Map` | `title`, `startDate` (`YYYY-MM-DD`), `numDays`, `dayStart`/`dayEnd` (`HH:mm`, the day's timeline window, default `06:00`/`21:00`) (plain values) |
| `cities` | `Y.Map<Y.Map>` | id → `{ id, name, color }` |
| `dayOverrides` | `Y.Map` | `YYYY-MM-DD` → `cityId` (manual per-day city) |
| `cards` | `Y.Map<Y.Map>` | id → `Card` fields |
| `accommodations` | `Y.Map<Y.Map>` | id → `Accommodation` fields |

Entities are stored as **nested `Y.Map`s** (not plain objects) so concurrent
edits to different fields of the same entity merge field-by-field instead of
clobbering — the point of using a CRDT. `.toJSON()` on an entity map yields
exactly the plain-JS type in `src/data/schema.ts`.

Dates are ISO **date-only** strings (`YYYY-MM-DD`); clock times are `HH:mm`
(24-hour, local to the trip — no timezone is modelled).

## Mutate only through `src/data/doc.ts`

`doc.ts` defines the doc shape and the **only** sanctioned mutators
(`addCard`, `updateCard`, `moveCard`, `reorderCards`, `addCity`,
`setDayCityOverride`, `addAccommodation`, …). Every write goes through one of
them, wrapped in a `doc.transact(...)` so it lands as one atomic update for both
local persistence and remote sync. Do **not** poke `Y.Map`s directly from
features or the Worker.

Patch semantics: in an update patch an explicit `undefined` value *clears* that
field (e.g. untiming a card); absent keys are left untouched.

Referential integrity: `removeCity` cascades — it also deletes any `dayOverrides`
entry and clears any accommodation `cityId` that pointed at the removed city, so
no dangling `cityId` reference survives (one would otherwise resolve to no-city
yet persist and round-trip through export).

## Shared between client and Worker — never duplicate

These `src/data/` modules are **environment-agnostic** and imported by *both* the
client and the Worker so the agent API and the UI can never drift. Keep them free
of browser- or Worker-only APIs:

- `schema.ts` — plain-JS domain types (`Trip`, `City`, `Day`, `Card`, `Accommodation`).
- `doc.ts` — the Y.Doc shape + typed mutators.
- `tripSchema.ts` — the **zod schema**, the single source of truth for the trip
  JSON *and* the agent API (`GET /api/schema` publishes it as JSON Schema).
  Validation lives here (`parseTripText`, `formatTripErrors`).
- `applyTrip.ts` — validated trip JSON → doc mutations (a full replace: clear,
  then re-add via the mutators). Used by `POST /api/trip/:room`.
- `exportTrip.ts` — doc → validated JSON. Used by `GET /api/trip/:room`.

`days.ts` (day generation) and `cityResolution.ts` are also pure shared logic.
`cityResolution.ts` resolves a day's city/color (`resolveDayCity`) *and* exposes
the stay-coverage helpers — `uncoveredDays`, `firstUncoveredDay`, `uncoveredGaps`
(contiguous gap ranges) — that drive the lane's per-gap "Add stay" buttons and the
preselected start date. `dateFormat.ts` holds the European display formatters
(`formatDay` → `dd.MM`, `formatDayLong` → `dd.MM.yyyy`, `formatTimeRange` →
24-hour `HH:mm`); stored values stay ISO, only the *display* is European. Date and
time entry uses the app's own pickers (see Styling), so display is European
everywhere — there are no native `<input type="date/time">` widgets that would
follow the OS locale.

When a value or rule needs to be known in two places, derive it from these
modules rather than re-stating it.

## City resolution (hybrid)

A day's city — and therefore its header color — is resolved, highest precedence
first:

1. a `dayOverrides` entry for that day,
2. the city of a covering accommodation (latest check-in wins on overlaps),
3. otherwise none — a travel day with no color.

## Card ordering

Time-bound cards (those with a `startTime`) sort by time; untimed cards keep a
manual `order` within their day. The combined ordering lives in
`src/features/cards/cardSort.ts`.

A card may carry an optional `category?: 'indoor' | 'outdoor' | 'transit'`
(drives the colour chip on the card and the Type segmented control in the
editor). It only changes rendering, not ordering. The legacy `transport?:
boolean` flag is kept valid for back-compat with older synced docs; `category`
supersedes it. Read the effective category through `cardCategory(card)` in
`src/features/cards/cardCategory.ts` — it returns `category`, else derives
`transport: true` as `'transit'` at read time (no bulk CRDT migration; the
editor rewrites to `category` and drops `transport` on the card's next save).

A card may also carry an optional `size?: 'auto' | 'small' | 'half' | 'full'`
height preset (absent = `auto` = sized from its start/end time). `half`/`full`
are relative to the day's `dayStart`–`dayEnd` window. The height math is pure and
unit-tested in `src/features/cards/cardHeight.ts`. Dragging an *untimed* card next
to timed cards infers a `startTime` from the drop position (snapped to 15 min) —
see `src/features/board/dndHandlers.ts`.

## Synced vs. per-user state

Not everything is on the doc. The **time-direction** view preference
(morning→evening top-to-bottom vs. bottom-to-top) is a *local* preference in
`localStorage`, deliberately **not** synced — each person sees their own
direction without affecting the other. It reverses the visual order of every card
in every day. See `src/features/board/timeDirection.ts`.

Rule of thumb: trip content is synced (doc); per-viewer display preferences are
local (localStorage).

## Styling / design tokens

Styling is inline Tailwind classes (no CSS modules). The "ink & type" design
tokens — the `serif` (Lora) / `sans` (Manrope) font families, the ink-neutral,
surface, border, city-hue and category-chip colours, and the frame/card/chip
radii — live in `tailwind.config.js` `theme.extend`. Components reference these
token class names; don't re-state hexes inline (the one exception is the dynamic
`style={{ backgroundColor: city.color }}` for a city's own colour).

Fonts are **self-hosted** via `@fontsource/lora` + `@fontsource/manrope`,
imported per-weight in `src/main.tsx` — not a Google Fonts `<link>`, because the
app is local-first and must render offline. `src/index.css` sets the base body
font (Manrope) and ink text colour.

The curated city palette (`CITY_PALETTE` in `src/features/cities/colors.ts`)
leads with the four named design hues (vermilion/pine/indigo/plum) plus a few
harmonious extras; `randomCityColor` still prefers an unused hue.

All editor pop-overs share one shell, `src/components/Modal.tsx` — the ink-scrim
backdrop + card + backdrop/Escape close + `role=dialog`/`aria-modal`/
`aria-label`. It is **viewport-responsive via Tailwind `lg:` classes, not a JS
branch** (`LAPTOP_BREAKPOINT` 1024 == `lg`): base = a full-screen mobile **sheet**
(`h-full w-full rounded-none`, `sheet-in` slide-up, a mobile-only sticky `‹`
close control); `lg:` restores the desktop centered scrim card. Its consumers
(`CardEditor`, `AccommodationEditor`, `TripModal`, `CityModal`) render their form
body inside it and keep their in-body `<h2>` title; each caps width with
`w-full lg:max-w-md` so desktop width is unchanged.
Trip-setup and Cities are **not** inline sections: on desktop the header carries
`[✎ Trip]` and `[◉ Cities]` buttons; on mobile these collapse into a `≡` menu
(`MobileMenu`, itself rendered through `Modal`) whose items open `TripModal` /
`CityModal` (`tripOpen`/`citiesOpen` flags in `App`'s `AppShell`) or trigger
"Add stay" — the create trigger is lifted into `AppShell` as an `addStayNonce`
(monotonic counter, so repeat taps re-open) passed to `Board`, which owns the
`AccommodationEditor`. All modals write **live** through the doc mutators (no
buffered save/cancel — consistent with the local-first CRDT model).

Field pop-overs (the date/time pickers) use a **different** shell,
`src/components/Popover.tsx` — an *anchored* floating panel pinned just below its
trigger (pure `popoverPosition` helper measuring rects; **no positioning
library**), with click-outside/Escape close and `role="dialog"`. On the mobile
viewport it falls back to the shared `Modal` sheet (reuse, not a second sheet).
`Modal` is centered/full-screen — for a field dropdown you want `Popover`.

Date and time entry is **custom, not native** (no `<input type="date/time">`):
- `src/features/pickers/DatePicker.tsx` — a calendar pop-over. Single-date mode
  (trip start in `TripModal`) and first→last **range** mode (a stay's nights in
  `AccommodationEditor`, one control replacing the two night inputs). Grid + range
  math is pure in `src/features/pickers/calendar.ts` (`monthGrid`, `nextRange`
  swap-reducer, `inRange`/`isEndpoint`); weeks start Sunday; ISO-string compare is
  chronological so no `Date` parsing is needed.
- `src/features/pickers/TimePicker.tsx` — an hour/minute wheel pop-over
  (`TripModal` day window, `CardEditor` start/end). Value lists + parse/format/snap
  are pure in `src/features/pickers/timeWheel.ts`. A `Clear` control (shown only
  when an `onClear` is passed — required trip-window fields have none) untimes a
  card by committing empty → the consumer patches `undefined` (doc.ts
  clear-semantics).
Both keep storage ISO (`YYYY-MM-DD`) / `HH:mm` and write through the doc mutators.

The desktop multi-week board carries navigation affordances in
`src/features/board/multiWeekNav.ts` (pure, unit-tested): a right-edge white fade
shown only while columns lie off-screen right (`showRightFade`), a **Jump to
today** button (`todayIndex`; absent when today is outside the trip), and a
date-range stepper (`visibleRange`/`rangeLabel`, European `dd.MM`) that pages the
horizontal scroll by a viewport width. These are desktop-only; the mobile
single-day view and `useViewport.ts` are unchanged.

## Auth / room-creation model

- The **room id lives in the URL hash** (`#room=<id>`) — the "secret link".
- `POST /api/auth` mints a room-scoped Liveblocks token **only for a room that
  already exists** → anyone with the link joins and co-edits, no login.
- `POST /api/rooms` creates a room and is gated by `OWNER_SECRET`
  (`x-owner-secret`). This is the *only* way rooms are created → "nobody but me
  can create rooms".
- The agent API (`GET`/`POST /api/trip/:room` and `GET /api/schema`, which
  publishes the JSON Schema derived from `tripDocumentSchema`) is **owner-gated**
  too — as privileged as room creation.
- `LIVEBLOCKS_SECRET_KEY` and `OWNER_SECRET` live **only on the Worker**. The
  client's only configured secret-adjacent value is `VITE_WORKER_URL`, a public
  URL baked into the bundle.

## Testing conventions

- TDD (red-green): write a failing test first, then implement to green.
- Prefer Playwright e2e against the real UI (the app is local-first, so e2e runs
  with no live backend) over mock-heavy unit tests.
- Reserve Vitest for pure `src/data/` logic; verify sync with a two-`Y.Doc`
  integration test (merge updates between docs), not by mocking Liveblocks.
- `src/data/devBridge.ts` exposes the live doc + mutators on `window.__planner`
  in **dev builds only** (tree-shaken from production) so Playwright can seed
  data before some data-entry UIs exist.

Commands: `npm test` (unit/integration), `npm run test:e2e`, `npm run lint`,
`npm run coverage`.
