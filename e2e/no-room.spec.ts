import { expect, test } from '@playwright/test'

// Opened without a board id in the URL hash, the app must not do anything:
// no board, no editing controls — just a quiet notice. Rooms are created
// out-of-band (owner API), so a bare visit has nothing to act on.
test('opening without a board id shows a notice and no board', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText(/slug url/i)).toBeVisible()
  // No board, no editing entry points.
  await expect(page.getByRole('region', { name: 'Board' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Trip' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cities' })).toHaveCount(0)
})
