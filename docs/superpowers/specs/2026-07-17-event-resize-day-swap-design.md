# Event Resize and Day Swap Design

## Goal

Make timeline editing feel direct: drag a card itself to move it, resize from either edge, snap every time change to 15 minutes, push collisions in the direction of the edit, and swap two complete activity days without moving accommodations.

## Movement

The dedicated move handle is removed. Pressing and dragging anywhere on a card moves it; a click still opens the editor, and links and resize handles remain independently interactive. The existing small pointer-distance activation threshold distinguishes a click from a drag.

Drops use visible day-body geometry and snap the activity start to 15-minute boundaries. Moving toward the visual top pushes the collision chain toward the visual top; moving toward the visual bottom pushes it toward the visual bottom. The scheduling engine translates that direction into earlier or later clock times from the active timeline direction. Cross-day movement uses the same visible movement direction.

Every affected start time is written in one Yjs transaction. If a collision chain reaches a day boundary, the active activity is clamped inward far enough to keep the chain in the configured window. If the complete chain cannot fit, unrelated activities retain their schedule and the active activity remains at a valid snapped time with the existing overlap indicator.

## Resizing

Timed cards have subtle top and bottom resize handles with larger invisible pointer targets. Dragging the bottom edge keeps the start fixed and changes the end. Dragging the top edge keeps the end fixed while changing the start and duration.

Both handles preview the new card geometry while the pointer is held and commit on release. Durations snap to 15 minutes with a 15-minute minimum. Resizing a `day` or `half` preset converts it to a `custom` duration.

Extending the visual top pushes collisions toward the visual top; extending the visual bottom pushes collisions toward the visual bottom. Shrinking never moves other activities. The same boundary and atomic-update rules as card movement apply. In reverse-time display mode, top and bottom remain visual edges, while the scheduling engine derives the correct chronological start/end change.

Untimed cards can still move to a timed position, but resize handles appear only after an activity has a start time because an untimed resize has no timeline edge to anchor.

## Quarter-hour duration model

Custom duration changes from a one-hour minimum to a quarter-hour minimum. Import/export validation accepts positive multiples of `0.25` hours and rejects other fractions. Document normalization, the card editor, layout math, resize math, and labels share the same rule.

The card editor's custom-duration input uses a `0.25` step and `0.25` minimum. Existing whole-hour documents remain valid.

## Day swapping

Each day header gets a compact `Swap day` action. It opens a focused dialog that names the source date, lets the user choose any other trip date, previews the two dates and cities, and requires one confirmation.

The swap runs in one Yjs transaction:

- every activity on the first date moves to the second date and vice versa;
- activity start times, durations, and manual order stay unchanged;
- the two currently displayed cities are pinned onto the opposite dates;
- accommodations and their date ranges are untouched.

To preserve a displayed cityless day when the other date inherits a city from accommodation, day overrides gain an explicit `No city` state. An absent override means `Auto`, `null` means `No city`, and a city id means a pinned city. Existing string-only documents remain valid and import unchanged.

## Scroll and rendering stability

The mounted application shell remains mounted after its first successful room connection, even if a collaborative update briefly returns the room to `connecting`. Dragging, resizing, or swapping therefore cannot reset horizontal or vertical scroll through a loading-state remount.

The board applies each interaction as one transaction and rerenders from the live document without replacing the scroll container.

## Accessibility

Cards remain keyboard-focusable and keyboard-draggable through dnd-kit. Resize handles are buttons with specific labels such as `Resize Museum start` and `Resize Museum end`; arrow-key resizing changes one 15-minute step and Shift+Arrow changes one hour. The swap dialog is keyboard-operable and announces both selected dates.

## Verification

Unit tests cover quarter-hour validation, both-direction collision packing, both resize edges, boundary behavior, atomic Yjs writes, explicit no-city resolution, and day swaps. Component tests cover whole-card dragging, removed move handles, resize controls, and the swap dialog.

Playwright tests drag and resize through real pointer coordinates, swap two populated days, verify accommodations stay fixed, and assert that board scroll positions do not jump. The final implementation is also exercised manually in the browser in both timeline directions.
