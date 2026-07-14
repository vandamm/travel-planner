import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('./', import.meta.url)
const pages = ['route-ledger', 'year-calendar']

for (const page of pages) {
  const html = await readFile(new URL(`${page}.html`, root), 'utf8')
  for (const required of [
    'shared.css',
    'shared.js',
    'data-view-switch',
    'aria-label="New trip"',
    '<span class="new-trip-label">Trip</span>',
  ]) {
    assert.ok(html.includes(required), `${page}.html is missing ${required}`)
  }
  assert.ok(!html.includes('data-holiday-toggle'), `${page}.html must always show holidays`)
  assert.ok(html.includes('>Calendar</a>'), `${page}.html needs the short Calendar label`)
  assert.ok(!html.includes('>Year calendar</a>'), `${page}.html must not use the long calendar label`)

  if (page !== 'year-calendar') {
    for (const required of ['Today', 'today-dot', 'countdown', 'month-marker', 'timeline-add']) {
      assert.ok(html.includes(required), `${page}.html is missing ${required}`)
    }
    assert.ok(html.includes('3 Aug. – 14 Sep.'), `${page}.html needs date-only holidays`)
    const holidayLabels = [...html.matchAll(/class="holiday-band"><span>([^<]+)/g)].map(
      ([, label]) => label,
    )
    assert.ok(holidayLabels.every((label) => !/holiday|free|Bavaria/i.test(label)))
  }
}

const calendar = await readFile(new URL('year-calendar.html', root), 'utf8')
assert.equal((calendar.match(/class="month-card/g) ?? []).length, 12)
assert.ok(!calendar.includes('The whole year'), 'calendar must not show the old kicker')
assert.ok(!calendar.includes('Your travel year'), 'calendar must not use the old title')
assert.ok(calendar.includes('<h2>Your travel calendar</h2>'), 'calendar needs its descriptive title')

const segments = await readFile(new URL('route-ledger.html', root), 'utf8')
assert.ok(segments.includes('class="route-segment'), 'route segments need trips on the rail')
assert.ok(segments.includes('<h2>Your travel timeline</h2>'), 'timeline needs its descriptive title')
assert.ok(segments.includes('route-segments'), 'route segments need a distinct page treatment')
assert.ok(!segments.includes('class="intro"'), 'final timeline must not have a pasted-on hero')
assert.ok(segments.includes('class="trip-countdown"'), 'trips need countdown labels')
assert.ok(!segments.includes('<a class="segment-copy" href="#"><span class="trip-countdown"'), 'countdowns belong left of the pill')
assert.ok(segments.includes('class="holiday-only"'), 'holidays need an example outside a trip')
assert.ok(!/\b(?:days|months) open\b/i.test(segments), 'route segments must not label open time')
assert.ok(!segments.includes('<span>September 2026</span>'), 'month boundaries inside holiday spans must be hidden')
assert.ok(segments.includes('class="embedded-month">January 2027'), 'winter holidays need an embedded January marker')
assert.ok(!segments.includes('<div class="month-marker"><span>January 2027'), 'embedded January must not be repeated outside the holiday')
assert.ok(segments.indexOf('class="view-switch"') < segments.indexOf('</header>'), 'view switch belongs in the header')

for (const removed of ['departure-board.html', 'family-atlas.html']) {
  await assert.rejects(readFile(new URL(removed, root), 'utf8'), { code: 'ENOENT' })
}

for (const color of ['trip-garda', 'trip-tyrol', 'trip-lisbon', 'trip-vienna']) {
  assert.ok(calendar.includes(color), `calendar needs persistent ${color} color`)
}

const js = await readFile(new URL('shared.js', root), 'utf8')
assert.ok(js.includes('Monday'), 'weekday initials need accessible seven-cell labels')

const css = await readFile(new URL('shared.css', root), 'utf8')
const headerRule = css.match(/\.site-header\s*\{([^}]*)\}/)?.[1] ?? ''
assert.ok(!headerRule.includes('border-bottom'), 'header must not have a horizontal divider')
assert.ok(!css.match(/@media \(max-width: 900px\)[\s\S]*?@media \(max-width: 620px\)/)?.[0].includes('.view-switch'), 'view switch must stay in the header row at tablet widths')
assert.ok(!css.includes('grid-row: 2'), 'view switch must never wrap to a second header row')
assert.ok(css.includes('grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)'), 'header columns must shrink without horizontal overflow')
assert.ok(css.includes('.brand-copy { display: none; }'), 'mobile header must collapse the brand to its seal')
assert.ok(css.includes('@media (max-width: 360px)'), 'the narrowest header needs its own compact state')
assert.ok(css.includes('.new-trip-label { display: none; }'), 'the narrowest add button must collapse to +')
assert.ok(css.includes('padding: 28px 30px 0'), 'timeline title must sit close to the header')
assert.ok(css.includes('padding: 28px 30px 90px'), 'calendar title must sit close to the header')
assert.equal((css.match(/@media \(max-width: 620px\)/g) ?? []).length, 1, '620px breakpoint must affect only the header')
assert.equal((css.match(/@media \(max-width: 480px\)/g) ?? []).length, 1, 'only the calendar grid should collapse at phone width')
assert.ok(!css.includes('--axis:'), 'timeline must stay centered at every viewport width')
assert.ok(!css.includes('var(--axis)'), 'mobile rules must not offset the timeline from its labels')
assert.ok(css.includes('repeat(3, minmax(0, 1fr))'), 'calendar needs at most three columns')
assert.ok(!css.includes('.month-marker::before'), 'month markers must not draw dividers')
assert.ok(css.includes('.month-marker::after'), 'month starts need short rail ticks')
assert.ok(css.includes('var(--trip-days)'), 'trip height must be based on duration')
assert.ok(css.includes('.route-segments .today::after { display: none; }'), 'Today must be only a dot')
assert.ok(css.includes('.route-segments .month-marker::after'), 'route month ticks must stop at the rail')
assert.ok(css.includes('.route-segments .segment-row .holiday-band'), 'route holiday bands must stop at the rail')
assert.ok(css.includes('.route-segments .holiday-band > span { background: transparent; }'), 'holiday date labels must not have a background')
assert.ok(css.includes('top: calc(var(--gap) + var(--trip-days) * 6px);'), 'trip information must center on its pill')
assert.ok(css.includes('.segment-timeline::after'), 'timeline needs an end arrow')

assert.ok(js.includes("querySelector('.timeline-add')"), 'timeline add button must follow the pointer')
assert.ok(js.includes("querySelectorAll('.route-segment')"), 'timeline add button must hide over trips')
assert.ok(js.includes('withinRail'), 'timeline add button must stop before rail endpoints')
assert.ok(!js.includes("[data-holiday-toggle]"), 'holidays must not be toggleable')
assert.ok(css.includes('cursor: pointer'), 'timeline add button needs a hand cursor')
assert.ok(css.includes('width: 22px'), 'timeline add button should match trip blob width')

console.log('2 final prototype pages passed static checks')
