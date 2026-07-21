# Event Manipulation Feedback Design

## Goal

Make moving and resizing activities predictable. Only the activity under the pointer changes, every time change snaps to 15 minutes, and the card becomes a quiet live timing hint during manipulation.

## Required changes

1. Make the normal card's resize affordances much less pronounced.
2. Stop moving or resizing neighboring activities. Collisions remain as overlaps.
3. Replace card details with live start, end, and duration values while moving or resizing.
4. Apply the approved pale-blue hint treatment within the app's design system.
5. Preserve the current whole-card drag surface, top and bottom resize behavior, 15-minute snapping, overlap marker, scroll stability, and keyboard resizing.

## Collision behavior

A move updates only the dragged activity's `dayKey` and snapped `startTime`. A resize updates only the active activity's `startTime`, `duration`, and `durationHours`. Neither operation changes another activity's schedule.

Overlaps are valid. After release, the existing `Overlap` marker reports the conflict. The active activity still clamps to the configured day boundaries and keeps its full duration where possible.

The timeline planner remains the single place for 15-minute snapping and boundary normalization, but collision packing and `pushed` schedule results are removed.

## Manipulation hint

As soon as pointer movement activates a card drag, the normal card content disappears. The source slot remains mounted and invisible so the board does not reflow; the drag overlay shows the timing hint at the pointer.

During a resize, the card itself changes to the timing hint. Its geometry continues to preview the resized height and top offset.

The hint contains only:

- snapped start time;
- a quiet directional arrow;
- snapped end time;
- duration formatted as hours and minutes, such as `1h 45m`.

The values update on every snapped drag or resize preview. A timed drag starts with the activity's current values. An untimed drag initially shows em dashes for start and end, then shows values as soon as it is positioned over a day timeline.

Releasing commits the preview and restores the normal card. Cancelling restores the original card without a write.

## Visual treatment

The hint extends the existing Manrope and indoor-blue language with dedicated semantic tokens:

- background: `#f3f5f7`;
- border: `#dde3e9`;
- primary text: `#34465a`;
- muted arrow: `#6f7e8e`;
- duration text: `#4f6275`.

The hint keeps the existing card radius, uses a thin one-pixel border, and has no prominent shadow. Start and end use 22px Manrope at medium weight. Duration uses 16px Manrope at medium weight and sits below a divider at 11% primary-text opacity. The treatment must read as passive feedback, not as a call to action.

The hint contains no activity title, note, category, link, conflict badge, instructional label, or resize handles.

The readable hint may extend beyond a very short activity's list-item box, but it never changes that box's measured timeline geometry or pushes neighboring cards.

## Resize affordances

Normal timed cards keep accessible top and bottom resize buttons with their existing pointer target size. Their visible marks become short one-pixel hairlines that are hidden at rest and appear faintly on hover or keyboard focus. The cursor and focus ring continue to identify the controls.

Untimed cards have no resize controls. Manipulation hints never show resize controls.

## Live preview architecture

`EventTimingHint` is a small presentational component shared by drag and resize states. It derives end time and the duration label from the same clock helpers used by timeline scheduling.

The drop handler exposes a pure preview function. `BoardDnd` uses it both while the pointer moves and on release, preventing preview and committed times from diverging.

`SortableCard` selects between the normal `Card` and `EventTimingHint` from `isDragging` and `resizePreview`. It preserves the list item's measured geometry throughout the interaction.

## Accessibility

The hidden resize marks do not shrink the buttons' hit targets. Keyboard focus reveals the correct edge and retains the visible focus ring. Arrow keys still resize by 15 minutes; Shift+Arrow still resizes by one hour.

The timing hint uses readable text rather than color alone. Existing dnd-kit keyboard movement remains available.

## Verification

Unit tests prove that move and resize operations leave neighboring schedules unchanged. Component tests cover hint content, semantic styling, hidden details and handles, and subtle resize affordances.

Playwright tests hold a real pointer while moving and resizing, verify live 15-minute updates, release into an overlap, and confirm that the neighboring activity, board scroll, and viewport position stay unchanged.
