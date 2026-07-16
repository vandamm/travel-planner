# Calendar Split Timeline — Production Handoff

## Purpose

Replace the existing home timeline with the selected **Calendar Split** composition. This is not a new demo: it is the timeline people see at `/`.

The page's job is to make upcoming journeys immediately desirable and legible. School holidays are useful calendar context, but must never compete with a trip.

The live visual reference is [timeline-holiday-options.html](../timeline-holiday-options.html). Integrate its Calendar Split treatment, not its prototype header, controls, static sample data, or explanatory copy.

## Composition

On desktop, keep the timeline rail exactly centred inside the existing `max-w-[900px]` content area.

```
calendar context                         journeys
month rule + label ──────────────── gap │ rail ├── start/end tick + trip copy
date-only holiday band ──────────────── │ rail ├── trip copy
                                         │
```

- The **left side** contains only calendar context: month/year marks and school-holiday periods.
- The **right side** contains only journey context: trip countdowns and trip links.
- The rail is a 2px neutral vertical line. It must remain visible between markers.
- Keep the existing one-scale date geometry: a position is always derived from its actual date with `timelineHeight`. Do not compress empty months or enlarge trip markers as a layout workaround.
- Continue the timeline to the viewport bottom when there are no dated trips; show as many whole/fractional months as fit. The end is only the arrow: do not show “Continue planning” or another label beside it.

## Today and calendar marks

- At the start of the rail show `15 JULY 2026` on the left, the vermilion outlined dot on the rail, and `TODAY` on the right. Use the real local current date, uppercase utility type, and the existing app palette.
- Every month boundary gets a quiet 1px rule from the left edge of the month word towards the rail, stopping with a visible gap before it. The rule must never cross or touch the rail.
- Use the **label-above-rule** version from the study in production. The two-option prototype control was for design review only; do not ship a control in the app.
- Month labels are uppercase, lighter than trip copy (about 600 weight), and should read as a datum rather than a headline.
- Replace a January month label with a large serif year mark such as `2027`. Its rule is 2px and visibly stronger/longer than month rules, while still stopping before the rail.
- A month/year mark may overlay a holiday band, but its rule must remain independent of the rail and its text must remain readable.

## School holidays

- Holidays are date-only calendar records. Do not render their names or a “school holidays” legend.
- Render each period as a flat, square-cornered, pale pine/green band in the left calendar lane. It ends at the rail side; it has no left border. A restrained top/bottom border and a slightly stronger rail-side edge are sufficient.
- Centre its uppercase date range vertically inside the band when space permits. The range remains visible for every duration, including short periods; use a compact format such as `2–6 NOV` or `24 DEC – 8 JAN`.
- Holiday fill, borders, and labels must be visibly present against the surface but substantially quieter than any trip colour. They are context, not cards.

## Trips

- A trip emerges from the rail into the right lane: use a coloured 14px vertical marker aligned to the trip's real start/end dates. There are no diamonds and no pill-like rounded ribbon.
- Add a 2px horizontal start tick and a 1px horizontal end tick, both extending right from the marker. Do not thicken the marker itself for one- or two-day trips; use a reasonable visual minimum height (16px) while retaining its date-positioned top.
- Keep long-trip information vertically centred against the marker. For one- and two-day trips, align the copy at the marker start so labels do not hang below the journey.
- The trip link has: title, a second line with date range, and a third line with duration only for trips lasting 3+ days. Omit duration for 1–2-day trips.
- Keep the countdown as quiet, right-side journey metadata. It must not appear in the calendar lane.

## Loading, empty state, and interaction

- Render `TimelineHome` immediately with empty trips and holidays. Fetching trips must occur in the background; the page must not be replaced by a “Loading trips…” screen.
- When trips arrive, add their markers and links without changing the underlying timeline scale unexpectedly. When the school-holiday fetch resolves, add its quiet left-lane records.
- Preserve the existing hover-to-add-trip affordance around the rail and the New Trip modal flow.
- Preserve the Calendar view and the existing home header unchanged.

## Responsive behaviour

- Keep calendar information left and journeys right on narrow screens. Shrink the left holiday lane and typography before hiding holiday dates.
- On narrow screens hide countdowns first if they no longer have room. Keep date ranges, trip names, month/year marks, and start/end ticks legible.
- Do not permit month/year rules to enter the rail at any viewport width.

## Acceptance checklist

- `/` shows the Calendar Split design, not the previous centred labels/full-half holiday bands.
- The timeline appears before the trips request finishes.
- The rail stays centred; calendar material is left and trip material is right.
- Month and year rules stop before the rail; January renders as a year mark.
- Holiday date ranges are visible and no holiday name is shown.
- One-day, two-day, and multi-day trips use the specified marker and copy treatment.
- The end arrow has no label.
