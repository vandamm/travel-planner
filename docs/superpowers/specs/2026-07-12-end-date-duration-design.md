# End Date and Activity Duration Design

## Scope

Build the first three agreed blocks. Defer coordinate-based activity drops and vertical resizing.

## Trip dates

`Trip` stores `startDate` and `endDate`; `numDays` is removed from types, Yjs storage, JSON, the Worker API, and the calendar home. Both dates are inclusive. A configured trip must have `endDate >= startDate`, and `generateDays(startDate, endDate)` produces at most 730 calendar days.

The Trip modal presents two date pickers. The header and home calendar derive the inclusive day count from the two dates.

## Activity duration

Each card stores one required duration mode: `day`, `half`, or `custom`. A custom duration also stores a required positive number of hours. The editor defaults new cards to `custom` and one hour. It removes the end-time control and the old size controls.

`day` and `half` resolve against the trip's configured `dayStart`–`dayEnd` window. Custom duration uses its stored hours. A card shows its start time and duration label when present. `endTime` and `size` are removed everywhere, including JSON validation and documentation.

## Responsive layout

The phone view applies below 768px. Tablets and larger screens use the existing scrolling board. Day columns become 17rem wide, about 21% wider than today, and every geometry consumer shares that value. The trip header spans the page width with the same horizontal inset as the board, rather than using a narrow maximum width.

## Constraints and checks

This is intentionally backwards-incompatible: no migration or legacy field support. Keep the existing Lora and Manrope visual system. Add tests before each behavioral change, then run unit tests, lint, build, and E2E checks.
