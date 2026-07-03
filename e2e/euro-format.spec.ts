import { expect, test } from '@playwright/test'
import { setupTrip } from './helpers'

// #1: displayed dates are European day-first (dd.MM), never month-name / US order.
// (Native picker *widgets* still follow the OS locale — see the plan's Post-Completion.)
test('day-column labels render day-first dd.MM', async ({ page }) => {
  await page.goto('/#room=e2e')
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 3 })

  const labels = page.getByTestId('day-label')
  await expect(labels).toHaveCount(3)

  // 2027-05-01 → "01.05" (day-first), not "May" / "05/01".
  await expect(labels.nth(0)).toHaveText(/\b01\.05\b/)
  await expect(labels.nth(0)).not.toHaveText(/May/)
  await expect(labels.nth(2)).toHaveText(/\b03\.05\b/)
})

test('document language is de so Firefox hints native pickers to dd.mm/24h', async ({ page }) => {
  await page.goto('/#room=e2e')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})
