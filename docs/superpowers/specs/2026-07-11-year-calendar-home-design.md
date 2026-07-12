# Year Calendar Home Design

## Goal

Turn the bare root route into a useful annual overview: show every trip on a twelve-month calendar, link each trip to its board, and let the signed-in owner create a new trip room.

## Design

The page is a compact "year atlas". A narrow masthead holds the product name, year controls, and the primary **New trip** button. Twelve month cards form a responsive 4x3 grid on desktop and a single column on small screens. Each date is a real calendar cell; trip dates join into continuous ribbons with rounded caps only at the start and end of each visible weekly segment. The trip's first visible date carries a short linked label. A linked trip index below the calendar makes every trip easy to find even when dates overlap.

Palette: midnight `#17233c`, paper `#f5f7fb`, white `#ffffff`, cobalt `#3157d5`, coral `#ef6a5b`, and mist `#dce4f4`. Lora remains the restrained display face; Manrope handles body copy and calendar data. The signature is the uninterrupted trip ribbon moving through otherwise quiet month grids.

## Data and behavior

`GET /api/rooms` returns room summaries in pages of 40 by listing Liveblocks rooms and reading each room's current Yjs trip document. This stays below Cloudflare's 50-subrequest Free-plan limit while the browser follows cursors until every room is loaded. Non-canonical room IDs and unreadable documents are skipped; empty valid trips remain listed but are not painted on the calendar. The root page supports previous/next year controls and shows a clear retryable error state.

**New trip** opens a small native form for a slug. Submitting calls the existing `POST /api/rooms`; success navigates directly to `/<slug>`, where the existing trip editor can set dates and details. Existing room routes and board behavior do not change.

## Accessibility and testing

Calendar days use semantic time elements, trip links remain reachable in the trip index, controls have visible focus styles, and motion is not required. Unit tests cover calendar date mapping, root-page rendering, room creation, and the Worker list route. The existing build, lint, unit suite, and a focused browser test verify the result.
