import { expect, test } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

// The mobile single-day view bounds the day timeline in a scroll container and
// overlays a fade + "scroll for more" hint only while there is more below. The
// affordance lives in MobileDayView (DayColumn stays shared/pure).
test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

test('a tall day shows the scroll hint, which clears at the bottom', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', numDays: 1 })

  // Seed a few tall cards so the day comfortably overflows the phone viewport.
  await page.evaluate(() => {
    const p = window.__planner!
    for (let i = 0; i < 5; i++)
      p.addCard(p.doc, { dayKey: '2027-05-01', title: `Card ${i}`, size: 'full' })
  })

  const hint = page.getByTestId('scroll-hint')
  const fade = page.getByTestId('scroll-fade')
  await expect(hint).toBeVisible()
  await expect(fade).toBeVisible()

  // Scroll the container to the bottom → the hint (and fade) clear.
  await page.getByTestId('mobile-day-scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await expect(hint).toHaveCount(0)
  await expect(fade).toHaveCount(0)
})

test('paging to another day resets the scroll position to the top', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', numDays: 2 })

  // Both days overflow so day 2 is also tall enough to hold a non-zero offset.
  await page.evaluate(() => {
    const p = window.__planner!
    for (const day of ['2027-05-01', '2027-05-02'])
      for (let i = 0; i < 5; i++)
        p.addCard(p.doc, { dayKey: day, title: `Card ${i}`, size: 'full' })
  })

  const scroll = page.getByTestId('mobile-day-scroll')
  await scroll.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)

  // Page to day 2 → the container returns to the top rather than keeping day 1's offset.
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByTestId('mobile-day-position')).toHaveText('Day 2 of 2')
  expect(await scroll.evaluate((el) => el.scrollTop)).toBe(0)
})

test('a short day that fits never shows the hint', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', numDays: 1 })

  // A narrow day window fits the viewport with no cards → no overflow.
  await page.evaluate(() => {
    const p = window.__planner!
    p.setTrip(p.doc, { dayStart: '09:00', dayEnd: '11:00' })
  })

  await expect(page.getByTestId('mobile-day-scroll')).toBeVisible()
  await expect(page.getByTestId('scroll-hint')).toHaveCount(0)
  await expect(page.getByTestId('scroll-fade')).toHaveCount(0)
})
