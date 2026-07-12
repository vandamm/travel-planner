import { expect, test } from '@playwright/test'

test('the front page shows the year calendar, trip links, and new trip flow', async ({ page }) => {
  await page.route('**/SchoolHolidays?**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/rooms', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{"id":"rome-2026"}',
      })
    } else {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          trips: [
            { id: 'summer-2026', title: 'Summer coast', startDate: '2026-07-15', numDays: 8 },
          ],
        }),
      })
    }
  })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Your travel year' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Summer coast 15 Jul – 22 Jul', exact: true }),
  ).toHaveAttribute('href', '/summer-2026')
  await expect(page.getByRole('region', { name: 'Board' })).toHaveCount(0)

  await page.getByRole('button', { name: /New trip/ }).click()
  await page.getByLabel('Trip slug').fill('rome-2026')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page).toHaveURL(/\/rome-2026$/)
})
