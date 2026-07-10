import { expect, test } from '@playwright/test'
import { addCity, E2E_LINK } from './helpers'

test('a slug link loads the board', async ({ page }) => {
  await page.goto(E2E_LINK)
  // The heading lives inside AppShell, which mounts only when a valid slug is present.
  await expect(page.getByRole('heading', { name: 'Travel Planner' })).toBeVisible()
})

test('a slug room can add a city', async ({ page }) => {
  await page.goto(E2E_LINK)
  await addCity(page, 'Rome')
})
