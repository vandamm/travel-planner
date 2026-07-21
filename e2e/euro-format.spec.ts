import { expect, test } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

test('day-column labels render the approved uppercase weekday and date', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const labels = page.getByTestId('day-label')
  await expect(labels).toHaveCount(3)

  await expect(labels.nth(0)).toHaveText('SAT · 01 MAY')
  await expect(labels.nth(2)).toHaveText('MON · 03 MAY')
})

test('document language is de so Firefox hints native pickers to dd.mm/24h', async ({ page }) => {
  await page.goto(E2E_LINK)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})
