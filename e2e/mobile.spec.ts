import { expect, test } from '@playwright/test'

// Drive the board on a phone-sized, touch-enabled viewport so it renders the
// single-day swipe view instead of the multi-column board.
test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

async function setUpTrip(page: import('@playwright/test').Page) {
  await page.getByLabel('Trip title').fill('Japan 2027')
  await page.getByLabel('Start date').fill('2027-05-01')
  await page.getByLabel('Number of days').fill('3')
}

test('mobile shows one day at a time and pages with prev/next, clamping at the ends', async ({
  page,
}) => {
  await page.goto('/')
  await setUpTrip(page)

  const columns = page.locator('[data-testid="day-column"]')
  const position = page.getByTestId('mobile-day-position')
  const prev = page.getByRole('button', { name: 'Previous day' })
  const next = page.getByRole('button', { name: 'Next day' })

  // Single-day view: exactly one column, starting on day 1, with prev clamped.
  await expect(columns).toHaveCount(1)
  await expect(position).toHaveText('Day 1 of 3')
  await expect(columns.first()).toHaveAttribute('data-day', '2027-05-01')
  await expect(prev).toBeDisabled()

  // Page forward to the last day; next clamps there.
  await next.click()
  await expect(position).toHaveText('Day 2 of 3')
  await expect(columns.first()).toHaveAttribute('data-day', '2027-05-02')

  await next.click()
  await expect(position).toHaveText('Day 3 of 3')
  await expect(columns.first()).toHaveAttribute('data-day', '2027-05-03')
  await expect(next).toBeDisabled()

  // And back again.
  await prev.click()
  await expect(position).toHaveText('Day 2 of 3')
})

test('mobile swipes between days', async ({ page }) => {
  await page.goto('/')
  await setUpTrip(page)

  const columns = page.locator('[data-testid="day-column"]')
  const position = page.getByTestId('mobile-day-position')

  await expect(position).toHaveText('Day 1 of 3')

  // Swipe left → next day.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="mobile-day-view"]')!
    const touch = (x: number) =>
      new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(320)], bubbles: true }))
    el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(40)], bubbles: true }))
  })
  await expect(position).toHaveText('Day 2 of 3')
  await expect(columns.first()).toHaveAttribute('data-day', '2027-05-02')

  // Swipe right → previous day.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="mobile-day-view"]')!
    const touch = (x: number) =>
      new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(40)], bubbles: true }))
    el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(320)], bubbles: true }))
  })
  await expect(position).toHaveText('Day 1 of 3')
})
