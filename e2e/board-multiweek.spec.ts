import { expect, test } from '@playwright/test'
import { HOUR_GUTTER_PX } from '../src/features/board/useViewport'
import { setupTrip, E2E_LINK } from './helpers'

// §9 desktop multi-week affordances: a right-edge fade while more columns lie
// off-screen, "Jump to today", and a date-range stepper that pages the scroll.
// These live in Board's desktop branch (the horizontally scrolling columns row).

test('a long trip shows the right-edge fade, which clears when scrolled fully right', async ({
  page,
}) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', endDate: '2027-05-14' })

  const fade = page.getByTestId('board-fade')
  await expect(fade).toBeVisible()

  // Scroll the columns row all the way right → the fade clears (nothing further).
  const scroll = page.getByTestId('board-scroll')
  await scroll.evaluate((el) => el.scrollTo({ left: el.scrollWidth }))
  await expect(fade).toHaveCount(0)
})

test('a short trip that fits shows no fade', async ({ page }) => {
  await page.goto(E2E_LINK)
  // A short trip expands its equal columns to fill the desktop board.
  await setupTrip(page, { title: 'Weekend', startDate: '2027-05-01', endDate: '2027-05-03' })

  const board = page.getByTestId('board')
  await expect(board).toBeVisible()
  await expect(page.getByTestId('board-fade')).toHaveCount(0)

  const geometry = await board.evaluate((element) => {
    const boardBox = element.getBoundingClientRect()
    const columns = Array.from(element.querySelectorAll<HTMLElement>('[data-testid="day-column"]'))
    return {
      boardWidth: boardBox.width,
      columnWidths: columns.map((column) => column.getBoundingClientRect().width),
      occupiedWidth:
        columns.at(-1)!.getBoundingClientRect().right - columns[0].getBoundingClientRect().left,
    }
  })
  expect(geometry.columnWidths).toHaveLength(3)
  expect(geometry.columnWidths[0]).toBeGreaterThan(272)
  expect(Math.max(...geometry.columnWidths) - Math.min(...geometry.columnWidths)).toBeLessThan(0.1)
  // The columns fill everything the shared hour gutter leaves them.
  expect(geometry.occupiedWidth).toBeCloseTo(geometry.boardWidth - HOUR_GUTTER_PX, 0)
})

test('Jump to today brings today’s column into view', async ({ page }) => {
  await page.goto(E2E_LINK)
  // Anchor the trip on the browser's real "today" so the component's `new Date()`
  // matches — then today is column 0 and a scroll-right hides it.
  const [today, endDate] = await page.evaluate(() => {
    const start = new Date()
    const end = new Date(start)
    end.setDate(end.getDate() + 13)
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
  })
  await setupTrip(page, { title: 'Now', startDate: today, endDate })

  const todayColumn = page.locator(`[data-day="${today}"]`)
  await page.getByTestId('board-scroll').evaluate((el) => el.scrollTo({ left: el.scrollWidth }))
  await expect(todayColumn).not.toBeInViewport()

  await page.getByRole('button', { name: 'Jump to today' }).click()
  await expect(todayColumn).toBeInViewport()
})

test('Jump to today is absent when today is outside the trip', async ({ page }) => {
  await page.goto(E2E_LINK)
  // A 3-day trip starting ~40 days out never contains the real "today".
  const [soon, endDate] = await page.evaluate(() => {
    const start = new Date()
    start.setDate(start.getDate() + 40)
    const end = new Date(start)
    end.setDate(end.getDate() + 2)
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
  })
  await setupTrip(page, { title: 'Upcoming', startDate: soon, endDate })
  await expect(page.locator('[data-testid="day-column"]')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Jump to today' })).toHaveCount(0)
})

test('the range stepper pages the scroll and updates its label', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', endDate: '2027-05-14' })

  const label = page.getByTestId('visible-range')
  const before = await label.textContent()
  expect(before).toContain('01.05') // starts at the trip's first day

  await page.getByRole('button', { name: 'Next days' }).click()
  const scroll = page.getByTestId('board-scroll')
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  await expect(label).not.toHaveText(before ?? '')
})

test('the now-line goes away when today is scrolled off screen', async ({ page }) => {
  await page.goto(E2E_LINK)
  // Anchor on the browser's real "today" so the component's `new Date()` agrees,
  // and widen the day window to the whole day so the line does not depend on
  // what time CI happens to run.
  const [today, endDate] = await page.evaluate(() => {
    const start = new Date()
    const end = new Date(start)
    end.setDate(end.getDate() + 13)
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
  })
  await setupTrip(page, { title: 'Now', startDate: today, endDate })
  await page.waitForFunction(() => Boolean((window as { __planner?: unknown }).__planner))
  await page.evaluate(() => {
    const planner = (window as unknown as { __planner: Record<string, never> }).__planner
    const { doc, setTrip } = planner as unknown as {
      doc: unknown
      setTrip: (doc: unknown, patch: Record<string, string>) => void
    }
    setTrip(doc, { dayStart: '00:00', dayEnd: '23:45' })
  })

  const board = page.getByTestId('board-scroll')
  // Today is column 0, so it is on screen and the line is drawn.
  await expect(page.getByTestId('now-line').first()).toBeVisible()
  await expect(page.getByTestId('now-pill')).toBeVisible()

  // Scroll past today: a "now" hairline over next week's columns would read as
  // if that day were happening right now.
  await board.evaluate((el) => el.scrollTo({ left: el.scrollWidth }))
  await expect(page.locator(`[data-day="${today}"]`)).not.toBeInViewport()
  await expect(page.getByTestId('now-line')).toHaveCount(0)
  await expect(page.getByTestId('now-pill')).toHaveCount(0)

  // Back to today and it returns.
  await page.getByRole('button', { name: 'Jump to today' }).click()
  await expect(page.getByTestId('now-line').first()).toBeVisible()
  await expect(page.getByTestId('now-pill')).toBeVisible()
})
