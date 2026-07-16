# Activity Timeline Geometry Design

## Goal

Give every planner day one clock scale. The configured day window determines the body's fixed height, and each activity's duration determines its visible height and position.

## Scale and duration

The planner uses `60px` per hour, or one pixel per minute. A day from `06:00` to `21:00` therefore has a `900px` body. The body uses a fixed height rather than a minimum height.

Cards keep the existing `day`, `half`, and `custom` duration modes. Day and half-day durations resolve from `dayStart` and `dayEnd`. Custom durations must be at least one hour. The schema rejects smaller values, the editor prevents them, and document updates normalize invalid values to one hour.

## Layout

The visible activity card and its sortable wrapper use the same exact pixel height. The card fills its wrapper and clips optional content that does not fit. The layout removes implicit flex gaps because they distort the clock scale.

A timed card's target position equals its distance from `dayStart` at one pixel per minute. In reverse-time mode, its target position equals its distance from `dayEnd`, including its duration. Untimed cards retain their manual order and flow from the current cursor.

The layout processes cards in display order. A card starts at its target position when that position follows the current cursor. If its scheduled time overlaps an earlier timed card, it starts at the cursor instead. Both scheduled cards receive the existing conflict marker. The fixed day body scrolls if shifted cards extend beyond its window.

## Components

`cardHeight.ts` owns minute conversion, the `60px` scale, resolved durations, window height, and card height. `DayColumn.tsx` owns target positions, collision shifting, the fixed scrollable body, and conflict markers. `Card.tsx` makes the visible article fill and clip to its assigned height. The schema, document helpers, and editor enforce the one-hour minimum.

## Checks

Unit tests cover the scale, fixed day height, duration resolution, one-hour validation, timed positions, reverse-time positions, shifted collisions, and visible card heights. The browser test measures the visible activity articles rather than their wrappers and verifies that trip-hour settings change the day height. Run the focused tests first, then the full unit suite, lint, build, and relevant browser tests.
