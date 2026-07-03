import { expect, test } from '@playwright/test'

test('dev server loads the app shell', async ({ page }) => {
  await page.goto('/#room=e2e')
  await expect(page.getByRole('heading', { name: 'Travel Planner' })).toBeVisible()
})
