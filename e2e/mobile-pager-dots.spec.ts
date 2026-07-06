import { expect, test } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

// City-coloured pager dots below the prev/next controls: one dot per day, the
// active dot carries aria-current, and tapping a dot jumps to that day.
test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

test('pager dots match the day count, mark the current day, and navigate on tap', async ({
  page,
}) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', numDays: 3 })

  const dots = page.getByTestId('mobile-day-dot')
  const position = page.getByTestId('mobile-day-position')
  await expect(dots).toHaveCount(3)

  // Day 1 active by default.
  await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true')
  await expect(dots.nth(2)).not.toHaveAttribute('aria-current', 'true')

  // Tap the last dot → jump to day 3, and the active dot follows.
  await dots.nth(2).click()
  await expect(position).toHaveText('Day 3 of 3')
  await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true')
  await expect(dots.nth(0)).not.toHaveAttribute('aria-current', 'true')
})
