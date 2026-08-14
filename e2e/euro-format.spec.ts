import { expect, test } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

test('day-column labels set the date as weekday, day-of-month and month', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const labels = page.getByTestId('day-label')
  await expect(labels).toHaveCount(3)

  // The month rides the first column only; the rest carry weekday + day.
  await expect(labels.nth(0)).toHaveText('SAT01MAY')
  await expect(labels.nth(2)).toHaveText('MON03')
})

test('document language is de so Firefox hints native pickers to dd.mm/24h', async ({ page }) => {
  await page.goto(E2E_LINK)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})
