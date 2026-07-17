# Task 4 Report: Explicit No-City Overrides and Atomic Day Swapping

## Status

Implemented and focused tests pass.

## Delivered behavior

- Day overrides now have three distinct states:
  - absent key: `Auto`, inherit from accommodation;
  - `null`: explicit `No city`, block accommodation inheritance;
  - string: pinned city id.
- `setDayCityOverride` deletes only for `undefined`; `null` persists.
- Schema validation, apply, export, JSON round-trips, and snapshots preserve
  explicit no-city overrides. Referential validation skips only `null`.
- The day city picker now includes `Auto`, `No city`, and each configured city.
- `swapActivityDays` resolves both displayed cities before writing, then uses
  one Yjs transaction to:
  - exchange every matching card's `dayKey`;
  - preserve every other card field;
  - pin each displayed city to the opposite date, using `null` for cityless;
  - leave accommodations unchanged.
- Desktop and mobile day headers expose the same `Swap day` action.
- `DaySwapModal` excludes the source date, previews both dates/cities, supports
  cityless targets, and confirms once.

## TDD evidence

The override tests first failed because `null` was deleted, inherited cities
were still resolved, and Zod rejected/export filtered `null`.

The swap tests first failed because `swapActivityDays` did not exist.

The UI tests first failed because the modal, no-city option, swap header action,
and mobile forwarding did not exist.

All became green after the minimal implementation.

## Verification

Exact requested command:

```sh
npm test -- src/data/doc.test.ts src/data/cityResolution.test.ts src/data/tripSchema.test.ts src/data/applyTrip.test.ts src/data/exportTrip.test.ts src/features/board/DaySwapModal.test.tsx src/features/board/DayColumn.test.tsx src/features/board/Board.test.tsx src/features/board/MobileDayView.test.tsx worker/src/snapshots.test.ts
```

Result: 10 test files passed, 157 tests passed, 0 failed.

`git diff --check` passed.

## Concerns

- `Board.test.tsx` still prints the pre-existing `RoomProvider` `act(...)`
  warning while passing.
- A full build was attempted, but concurrent Task 3 red-test work currently
  leaves JSX in `src/features/board/dndContext.test.ts`; TypeScript stops on that
  external syntax error before checking the full project. Task 4's requested
  focused suite is green.
- Concurrent Task 2/3 files were not staged or committed.
