import { expect, test } from '@playwright/test'
import { setupTrip } from './helpers'

test('a card set to whole-day grows taller than a default card', async ({ page }) => {
  await page.goto('/#room=e2e')

  await setupTrip(page, { title: 'Heights', startDate: '2027-05-01', numDays: 1 })

  const column = page.locator('[data-testid="day-column"]').first()

  // A default-height card (exact duration, untimed → one block).
  await column.getByRole('button', { name: /Add card/ }).click()
  let editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('Quick stop')
  await editor.getByRole('button', { name: 'Save card' }).click()

  // A whole-day card.
  await column.getByRole('button', { name: /Add card/ }).click()
  editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('All day tour')
  await editor.getByRole('button', { name: 'Whole day' }).click()
  await editor.getByRole('button', { name: 'Save card' }).click()

  const defaultCard = column.locator('[data-testid="card-list"] > li', { hasText: 'Quick stop' })
  const fullCard = column.locator('[data-testid="card-list"] > li', { hasText: 'All day tour' })

  const defaultBox = await defaultCard.boundingBox()
  const fullBox = await fullCard.boundingBox()
  expect(defaultBox).not.toBeNull()
  expect(fullBox).not.toBeNull()
  // 15h window → 660px vs the 44px default block: comfortably more than triple.
  expect(fullBox!.height).toBeGreaterThan(defaultBox!.height * 3)
})
