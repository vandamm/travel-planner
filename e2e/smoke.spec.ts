import { expect, test } from '@playwright/test'
import { addCity, E2E_LINK } from './helpers'

test('a token link loads the board', async ({ page }) => {
  await page.goto(E2E_LINK)
  // The heading lives inside AppShell, which mounts only when the token decodes.
  await expect(page.getByRole('heading', { name: 'Travel Planner' })).toBeVisible()
})

test('an edit link can add a city', async ({ page }) => {
  await page.goto(E2E_LINK)
  // E2E_LINK carries `edit` perms → editing is available. addCity asserts the
  // new row appears in the Cities modal, proving the write landed on the doc.
  await addCity(page, 'Rome')
})
