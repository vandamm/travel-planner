# Task 1 report — quarter-hour duration contract

## Delivered

- Added shared `SNAP_MINUTES = 15`, `MIN_CARD_MINUTES = 15`, hour/minute converters, and a quarter-hour duration predicate in `cardHeight.ts`.
- Accepted custom card durations from `0.25` hours upward in 15-minute increments; invalid, sub-minimum, or non-finite document values normalize to the existing one-hour default.
- Applied the same minimum/increment contract to the import/Worker JSON schema and the Card Editor number input/submission guard.
- Added regression coverage for card layout, document add/update normalization, schema validation and generated schema, editor submission, and stored snapshot JSON.

## TDD evidence

The required red run was executed before production-code changes:

```sh
npm test -- src/features/cards/cardHeight.test.ts src/data/doc.test.ts src/data/tripSchema.test.ts
```

It failed as intended: 4 failures confirmed that `0.25` was floored to `1`, shared constants were absent, document writes normalized `0.25` to `1`, and the schema rejected `0.25`.

The focused green run then passed:

```sh
npm test -- src/features/cards/cardHeight.test.ts src/data/doc.test.ts src/data/tripSchema.test.ts src/features/cards/CardEditor.test.tsx worker/src/snapshots.test.ts worker/src/trip.test.ts
```

Result: 6 files, 90 tests passed.

## Full-suite evidence

One full `npm test` run was executed. Task 1's focused files passed, but the suite is currently blocked by unrelated concurrent board-scheduling work:

- `src/features/board/dndHandlers.test.ts`: three expectations now require 15-minute snapping while `dndHandlers.ts` still uses its local 30-minute snap constant.
- `src/features/board/timelineSchedule.test.ts`: imports a missing `./timelineSchedule` module.

Result: 51 files passed; 3 tests failed and 1 suite failed to load. These files are outside Task 1 and were left unchanged.

## Legacy-duration compatibility follow-up

Review found that strict schema/layout validation would rewrite or reject existing
non-quarter custom durations such as `1.1`. Added TDD coverage confirmed the
failure before the fix: legacy values rendered as `1`, unrelated `updateCard`
calls rewrote them, and export rejected them.

- Stored finite custom durations at least 15 minutes now remain readable and
  exportable, including legacy non-quarter values.
- `updateCard` normalizes only patches that change `duration` or
  `durationHours`; unrelated updates retain the stored duration.
- New `addCard`, duration-changing `updateCard`, and Card Editor writes retain
  the stricter 15-minute predicate.
- The published JSON schema preserves legacy round-trips with `minimum: 0.25`
  but no `multipleOf`; document mutators remain the write-time enforcement
  boundary.

Focused follow-up verification passed: 5 files, 84 tests passed.
