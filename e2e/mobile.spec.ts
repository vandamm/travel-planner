import { expect, test } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

// Drive the board on a phone-sized, touch-enabled viewport so it renders the
// single-day swipe view instead of the multi-column board.
test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

async function setUpTrip(page: import('@playwright/test').Page) {
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', endDate: '2027-05-03' })
}

test('mobile shows one day at a time and pages with prev/next, clamping at the ends', async ({
  page,
}) => {
  await page.goto(E2E_LINK)
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
  await page.goto(E2E_LINK)
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

test('mobile sheet inputs use a 16px font to prevent iOS focus zoom', async ({ page }) => {
  await page.goto(E2E_LINK)
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Menu' })
    .getByRole('button', { name: 'Cities & colours' })
    .click()

  const fontSize = await page.getByLabel('New city name').evaluate((input) =>
    Number.parseFloat(getComputedStyle(input).fontSize),
  )
  expect(fontSize).toBeGreaterThanOrEqual(16)
})

test('double-tap zoom is off, but pinch zoom is still allowed', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setUpTrip(page)

  // `manipulation` drops the double tap (and its 300ms click delay) while
  // keeping panning and pinch. It intersects down the tree, so covering body
  // covers the board.
  const touchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction)
  expect(touchAction).toBe('manipulation')

  // Note there is nothing to assert on a descendant: `touch-action` is not
  // inherited, so the board's computed value is still "auto" — it is the
  // browser's intersection up the chain that suppresses the gesture.

  // Pinch zoom must survive: never pin the scale or disable user scaling, or
  // small text becomes unreadable for anyone who needs to magnify it.
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/)
  expect(viewport).not.toMatch(/maximum-scale/)
})
