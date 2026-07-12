import { expect, test } from '@playwright/test'
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
  // Three ~224px columns fit a desktop viewport with room to spare → no overflow.
  await setupTrip(page, { title: 'Weekend', startDate: '2027-05-01', endDate: '2027-05-03' })

  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByTestId('board-fade')).toHaveCount(0)
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
  const soon = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() + 40)
    return d.toISOString().slice(0, 10)
  })
  const endDate = await page.evaluate(() => {
    const date = new Date()
    date.setDate(date.getDate() + 9)
    return date.toISOString().slice(0, 10)
  })
  await setupTrip(page, { title: 'Upcoming', startDate: soon, endDate })
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
