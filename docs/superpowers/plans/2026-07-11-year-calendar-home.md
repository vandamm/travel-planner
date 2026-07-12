# Year Calendar Home Implementation Plan

> **For agentic workers:** Execute inline with test-driven development; no subagents are needed for these two coupled tasks.

**Goal:** Build a working annual trip-calendar homepage with links and room creation.

**Architecture:** Extend the existing Worker room abstraction with one list method and expose summaries at `GET /api/rooms`. Render those summaries through a focused React homepage and pure calendar helpers while preserving all slug routes.

**Tech Stack:** React 18, TypeScript, date-fns, Tailwind CSS, Cloudflare Workers, Vitest, Playwright.

## Global Constraints

- Add no dependency.
- Preserve existing board routes and production secrets.
- List 40 rooms per request to remain below the Workers Free-plan subrequest limit; the browser follows cursors.
- Follow red-green-refactor for behavior changes.

---

### Task 1: Room summaries API

**Files:** Modify `worker/src/liveblocks.ts`, `worker/src/rooms.ts`, `worker/src/index.ts`; test `worker/src/rooms.test.ts` and `worker/src/index.test.ts`.

- [ ] Add failing tests proving `GET /api/rooms` returns trip summaries and rejects non-GET/POST methods.
- [ ] Add `listRooms()` to `LiveblocksApi`, backed by `GET /v2/rooms?limit=40`.
- [ ] Decode each room Yjs document with existing `exportTrip` utilities and return minimal summaries.
- [ ] Run focused Worker tests, then the complete unit suite.

### Task 2: Annual calendar homepage

**Files:** Create `src/features/home/yearCalendar.ts`, `src/features/home/YearCalendarHome.tsx`; modify `src/App.tsx`, `src/App.test.tsx`, `src/index.css`, `e2e/no-room.spec.ts`; test `src/features/home/yearCalendar.test.ts`.

- [ ] Add failing tests for leap-year month grids, trip/date overlap, homepage links, year navigation, and room creation.
- [ ] Implement pure date helpers with date-fns.
- [ ] Implement the responsive year-atlas page, error/loading states, and new-room dialog.
- [ ] Replace only the root-route `NoRoom` view; retain invalid-path behavior as a quiet notice.
- [ ] Run unit tests, lint, build, and focused Playwright verification.
