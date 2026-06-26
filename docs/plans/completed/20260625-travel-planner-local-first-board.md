# Travel Planner — Local-First Collaborative Day-Board

## Overview

A laptop-first, mobile-friendly web app for two people to visually plan a multi-week trip on a board where each column is a day. Days are color-coded by city, host activity cards on a continuous time scale (only time-bound cards like trains/flights carry real start/end times), and show accommodation as spanning bars across the nights they cover. Edits persist instantly to local storage (IndexedDB) and sync in the background via Liveblocks + Yjs (CRDT), so two people can co-edit the same board in real time. Access is via a secret link (room id in the URL) with no login; a small Cloudflare Worker holds the Liveblocks secret key, mints access tokens, and restricts new-room creation to the owner. The same Worker exposes a structured HTTP API so an AI agent can read the whole trip and write it back — you discuss the plan with the agent and it visualizes it directly in the room.

## Context

- Files involved: fresh repo — only `README.md` and git exist. Everything is created from scratch. (`plan.md` at the repo root is the prior annotated draft and is not part of the build.)
- Target stack (client):
  - Vite + React + TypeScript (static SPA, deployed to Cloudflare Pages)
  - Yjs (CRDT document) + `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/yjs` for background sync
  - `y-indexeddb` for immediate local-first persistence (the app is fully usable offline on local data alone)
  - `@dnd-kit/core` + `@dnd-kit/sortable` for drag/drop and reordering
  - `zod` for the import/export + agent-API schema (the "schema agents can target")
  - `date-fns` for date math (day-range generation, formatting)
  - Tailwind CSS for styling
- Target stack (backend): a single Cloudflare Worker (`worker/`) using `@liveblocks/node` (or Liveblocks REST via fetch) for token minting, room creation, and server-side Yjs read/write. Configured/deployed with Wrangler.
- Test stack: Vitest + React Testing Library + jsdom for pure-logic unit tests; Playwright for end-to-end UI flows.
- Related patterns: none yet (greenfield). Conventions established in Task 1.
- Dependencies / external services: a Liveblocks account + secret key (free tier), held only by the Worker (never shipped to the client). A separate owner secret gates room creation and the agent API. The room id lives in the URL hash (the "secret link").
- Access model: the client authenticates through the Worker's auth endpoint, not a public key. The Worker issues a token only for a room that already exists, so anyone with the secret link can join and edit without logging in; creating a new room requires the owner secret. This satisfies "nobody but me can create rooms" while keeping your wife's access login-free.
- Shared code: the zod schema, the Y.Doc shape, the typed doc mutators, and the "trip JSON → doc" apply logic live in environment-agnostic modules under `src/data/` and are imported by BOTH the client and the Worker, so the agent API and the UI never drift.
- Key design notes:
  - The per-user time-direction toggle (morning→evening top-to-bottom vs. bottom-to-top) is a local view preference (localStorage), NOT synced state — each person sees their own direction; it reverses the vertical order of every card in every day.
  - Activity cards: optional `startTime`/`endTime`. Time-bound cards (e.g. trains/flights) auto-sort by time; untimed cards keep a manual `order`.
  - Accommodation bars define a day's city/color (hybrid); a per-day manual `cityOverride` wins when set.

## Development Approach

- **Testing approach**: TDD (red-green) — write a failing test first, then implement to green, for every task.
- Prefer Playwright end-to-end tests that drive the real UI over mocked unit tests. Because the app is local-first (renders and edits on IndexedDB alone), e2e flows run against the dev server with no live backend.
- Reserve Vitest unit tests for pure, environment-agnostic logic (day generation, city resolution, card sort, schema validation, doc mutators, trip-apply) where they're fast and not mock-heavy.
- Verify collaborative sync with a focused two-`Y.Doc` integration test (merge updates between two docs) rather than mocking Liveblocks.
- Keep the Yjs document the single source of truth; the shared `src/data/` modules are the only place that mutates it, so client and Worker stay consistent.
- Complete each task fully before moving to the next.
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting the next task**

## Implementation Steps

### Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`
- Create: `tailwind.config.js`, `postcss.config.js`, `src/index.css`
- Create: `vitest.config.ts` (or merged into vite config), `src/test/setup.ts`
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Create: `eslint.config.js`, `.prettierrc`, `.gitignore`, `.env.example` (client `VITE_` vars: Worker base URL)

- [x] Scaffold Vite + React + TypeScript and install the client + test dependencies listed in Context
- [x] Configure Tailwind, ESLint, Prettier, Vitest (jsdom + RTL setup), and Playwright
- [x] Add a minimal `App` placeholder shell and npm scripts: `dev`, `build`, `test`, `test:e2e`, `lint`, `coverage`
- [x] write tests for this task: a Vitest smoke test (`App` renders) and a Playwright smoke spec (dev server loads the shell) — red first, then green
- [x] run unit + e2e suites — must pass before Task 2

### Task 2: Cloudflare Worker — Liveblocks auth and owner-gated room creation

**Files:**
- Create: `worker/wrangler.toml`, `worker/tsconfig.json`
- Create: `worker/src/index.ts` (request router + CORS)
- Create: `worker/src/auth.ts` (mint room-scoped Liveblocks token only for an existing room)
- Create: `worker/src/rooms.ts` (create a room only when the owner secret is presented)
- Create: `worker/.dev.vars.example` (`LIVEBLOCKS_SECRET_KEY`, `OWNER_SECRET`)

- [x] write failing tests first (Vitest against the Worker handlers / Miniflare): existing room → token issued; unknown room without owner secret → denied; `POST /api/rooms` without owner secret → 401; with owner secret → room created
- [x] Implement `POST /api/auth`: look up the room via Liveblocks; if it exists, mint a room-scoped access token; otherwise deny
- [x] Implement `POST /api/rooms` gated by `OWNER_SECRET`: create a new Liveblocks room and return its id
- [x] run worker test suite — must pass before Task 3

### Task 3: Yjs data model, shared doc helpers, local persistence, and sync via the Worker

**Files:**
- Create: `src/data/schema.ts` (TypeScript types: Trip, City, Day, Card, Accommodation)
- Create: `src/data/doc.ts` (environment-agnostic Y.Doc shape + typed mutators; imported by client and Worker)
- Create: `src/data/provider.ts` (`y-indexeddb` + Liveblocks Yjs provider using the Worker `authEndpoint`; room id from `location.hash`; "new trip" calls `POST /api/rooms`)
- Create: `src/data/RoomProvider.tsx` (React provider exposing the synced doc + connection status)

- [x] write failing tests first: mutator helpers against an in-memory `Y.Doc` (add/update/move/reorder/delete) and a two-doc sync integration test
- [x] Define the Y.Doc shape: `trip` (title, startDate, numDays), `cities`, `dayOverrides` (keyed by date), `cards`, `accommodations`
- [x] Implement environment-agnostic typed mutators (addCard, updateCard, moveCard, reorderCards, addCity, setDayCityOverride, addAccommodation, …)
- [x] Wire `y-indexeddb` (immediate local persistence) and the Liveblocks Yjs provider authenticating through the Worker; derive the room id from the URL hash; ensure the app still loads/edits with no sync connection
- [x] run unit + integration suites — must pass before Task 4

### Task 4: Trip setup, cities, and city-resolution logic

**Files:**
- Create: `src/features/trip/TripSettings.tsx` (title, start date, number of days)
- Create: `src/features/cities/CityManager.tsx` (add/edit/remove cities with colors)
- Create: `src/data/days.ts` (ordered day list from start date + numDays via date-fns)
- Create: `src/data/cityResolution.ts` (hybrid: resolve each day's city/color from the covering accommodation bar, override winning)

- [x] write failing tests first: `generateDays` (incl. boundaries) and `resolveDayCity` (derived-from-accommodation, override-wins, no-accommodation/travel-day fallback) as unit tests; a Playwright flow for setting up a trip + cities
- [x] Build the trip-settings UI writing to the `trip` map and the city manager (name + color) writing to `cities`
- [x] Implement `generateDays` and `resolveDayCity` as pure functions
- [x] run unit + e2e suites — must pass before Task 5

### Task 5: Day board layout, time scale, and direction toggle

**Files:**
- Create: `src/features/board/Board.tsx` (horizontal scroll of day columns)
- Create: `src/features/board/DayColumn.tsx` (header with city name/color; continuous time scale)
- Create: `src/features/board/timeDirection.ts` (localStorage preference + ordering helper)
- Create: `src/features/board/useTimeDirection.ts` (hook)

- [x] write failing tests first: the ordering helper for both directions across timed + untimed cards (unit); a Playwright test that toggles direction and asserts the visible order reverses and persists across reload
- [x] Render one column per day with a color-coded, city-labeled header and a continuous morning→afternoon→evening scale
- [x] Implement the per-user time-direction toggle (localStorage) reversing the visual order of every card in every day
- [x] run unit + e2e suites — must pass before Task 6

### Task 6: Activity cards — create, edit, sort

**Files:**
- Create: `src/features/cards/Card.tsx` (display: title, optional note, optional link, optional time)
- Create: `src/features/cards/CardEditor.tsx` (create/edit form; toggle for time-bound start/end)
- Create: `src/features/cards/cardSort.ts` (timed cards by start time; untimed keep manual `order`)

- [x] write failing tests first: sort logic with mixed timed/untimed cards (unit); a Playwright flow that creates, edits, and deletes a card and sees it on the board
- [x] Build the card display and create/edit/delete editor (title, note, link, optional start/end time, color/icon)
- [x] Implement the combined column ordering (timed by time, untimed by manual order)
- [x] run unit + e2e suites — must pass before Task 7

### Task 7: Drag-and-drop reordering and moving between days

**Files:**
- Create: `src/features/board/dndContext.tsx` (dnd-kit context + sensors)
- Create: `src/features/board/dndHandlers.ts` (translate drag events into doc mutations)
- Modify: `src/features/board/DayColumn.tsx`, `src/features/cards/Card.tsx` (sortable wiring)

- [x] write failing tests first: drag-handler functions (reorder within a day; move across days updating `dayKey` + `order`) as unit tests; a Playwright drag test moving a card between columns
- [x] Wire dnd-kit so untimed cards reorder within a day and any card can move to another day, routing every change through the shared Yjs mutators
- [x] run unit + e2e suites — must pass before Task 8

### Task 8: Accommodation spanning bars

**Files:**
- Create: `src/features/accommodation/AccommodationBar.tsx` (a bar spanning its nights, above the columns)
- Create: `src/features/accommodation/AccommodationLane.tsx` (positions bars over the day grid)
- Create: `src/features/accommodation/AccommodationEditor.tsx` (label, city, start/end night)
- Modify: `src/features/board/Board.tsx` (mount the lane), `src/data/cityResolution.ts` (consume spans)

- [x] write failing tests first: span-to-columns geometry/coverage (unit) and that accommodation drives a day's city/color unless overridden (unit); a Playwright flow adding accommodation and seeing day headers recolor
- [x] Render accommodation as horizontal bars spanning the nights between days, positioned over the columns
- [x] Build the add/edit accommodation flow (label, city, date span) writing to `accommodations`, feeding the hybrid city resolution
- [x] run unit + e2e suites — must pass before Task 9

### Task 9: Structured trip schema and import/export (client)

**Files:**
- Create: `src/data/tripSchema.ts` (zod schema — single source of truth for trip settings, cities, accommodations, cards)
- Create: `src/data/applyTrip.ts` (environment-agnostic: validated trip JSON → doc mutations; shared with the Worker)
- Create: `src/data/exportTrip.ts` (doc → validated JSON)
- Create: `src/features/io/ImportExport.tsx` (download export / paste-or-upload import UI)
- Create: `docs/trip-schema.md` (human + agent-readable description of the JSON schema)

- [x] write failing tests first: export→import round-trip preserves data; invalid JSON rejected with a clear error; `applyTrip` mutates the doc to the expected state (unit) — plus a Playwright import-then-render flow
- [x] Define the zod schema as the single source of truth
- [x] Implement `exportTrip` (doc → validated JSON) and `applyTrip` (validated JSON → doc), and build the import/export UI surfacing validation errors
- [x] run unit + e2e suites — must pass before Task 10

### Task 10: Agent HTTP API on the Worker (read/write the room)

**Files:**
- Create: `worker/src/trip.ts` (GET serializes the room's Yjs doc to trip JSON; POST validates + applies + pushes back)
- Modify: `worker/src/index.ts` (route `/api/trip/:room`)

- [x] write failing tests first: `GET /api/trip/:room` returns current trip JSON; `POST` with valid JSON updates the doc; `POST` invalid JSON → 400; both require the owner token
- [x] Implement `GET /api/trip/:room`: load the room's Yjs doc via Liveblocks and serialize with the shared schema/`exportTrip`
- [x] Implement `POST /api/trip/:room`: validate with the zod schema, apply via the shared `applyTrip`, and send the Yjs binary update to Liveblocks so connected clients merge it live; gate by the owner token
- [x] run worker test suite — must pass before Task 11

### Task 11: Mobile single-day swipe view

**Files:**
- Create: `src/features/board/MobileDayView.tsx` (one day at a time)
- Create: `src/features/board/useViewport.ts` (breakpoint detection)
- Modify: `src/features/board/Board.tsx` (switch desktop multi-column vs. mobile single-day)

- [x] write failing tests first: viewport hook selects the right view and day-navigation index clamps at first/last (unit); a Playwright mobile-viewport test swiping/paging between days
- [x] Below the laptop breakpoint, render a single day with left/right swipe and prev/next controls, reusing the same cards/accommodation/time-direction logic
- [x] run unit + e2e suites — must pass before Task 12

### Task 12: Cloudflare deployment configuration and docs

**Files:**
- Modify: `worker/wrangler.toml` (production env, route, secret bindings for `LIVEBLOCKS_SECRET_KEY` + `OWNER_SECRET`)
- Modify: `package.json` (scripts: `build`, `deploy:worker`, `worker:dev`)
- Create: `docs/deployment.md` (Cloudflare Pages + Worker deploy flow, env/secret setup, secret-link sharing)
- Create: Pages build config note (build command `vite build`, output `dist`, `VITE_` Worker URL)

- [x] Configure the Cloudflare Pages build (command, output dir, `VITE_` Worker base URL) and the Worker production settings in `wrangler.toml`
- [x] Add deploy/build npm scripts and document the full deploy flow in `docs/deployment.md`
- [x] verify config by running `vite build` and `wrangler deploy --dry-run` (no live deploy needed)
- [x] run unit + e2e suites — must pass before Task 13

### Task 13: Verify acceptance criteria

- [x] run the full unit suite (`npm test`) — 184 tests passed (29 files)
- [x] run the Playwright e2e suite (`npm run test:e2e`) — 12 tests passed
- [x] run the linter (`npm run lint`) — 0 errors (2 react-refresh warnings only)
- [x] verify unit-test coverage of the `src/data/` logic modules meets 80%+ (`npm run coverage`) — 88.57% aggregate
- [x] run `wrangler deploy --dry-run` to confirm the Worker builds — builds (381.85 KiB / 71.02 KiB gzip)

### Task 14: Update documentation

- [x] update `README.md` with setup, the Worker/Pages architecture, dev/build instructions, env vars, and how the secret-link room id works
- [x] ensure `docs/trip-schema.md` and a short agent-API section (GET/POST `/api/trip/:room`, owner token, example payloads) are documented for agents
- [x] add `CLAUDE.md` capturing data-model conventions (Y.Doc shape, shared mutators/apply between client and Worker, per-user vs. synced state, auth/room-creation model)

## Post-Completion (manual — requires your Cloudflare/Liveblocks accounts)

- Create a Liveblocks account and obtain the secret key; choose an owner secret.
- Set the Worker secrets (`wrangler secret put LIVEBLOCKS_SECRET_KEY`, `OWNER_SECRET`) and `wrangler deploy`.
- Deploy the SPA to Cloudflare Pages and set the `VITE_` Worker URL.
- Create the first room as owner, then share the secret link with your wife.
- Smoke-test the agent path: `GET`/`POST /api/trip/:room` against the live Worker and confirm the board updates live.
