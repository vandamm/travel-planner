import { expect, test } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

test('a card set to whole-day grows taller than a default card', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
    const fetch = globalThis.fetch
    globalThis.fetch = (input, init) =>
      String(input).includes('/api/auth') ? new Promise<Response>(() => {}) : fetch(input, init)
  })
  await page.goto(E2E_LINK)

  await setupTrip(page, { title: 'Heights', startDate: '2027-05-01', endDate: '2027-05-01' })

  const column = page.locator('[data-testid="day-column"]').first()
  const dayBody = await column.getByTestId('day-body').boundingBox()
  expect(dayBody).not.toBeNull()
  expect(dayBody!.height).toBe(900)

  // A default-height card (exact duration, untimed → one block).
  await column.getByRole('button', { name: /Add card/ }).click()
  let editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('Quick stop')
  await editor.getByRole('button', { name: 'Save card' }).click()

  // A whole-day card.
  await column.getByRole('button', { name: /Add card/ }).click()
  editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('All day tour')
  await editor.getByRole('button', { name: 'Day', exact: true }).click()
  await editor.getByRole('button', { name: 'Save card' }).click()

  const defaultCard = column.locator('[data-testid="card-list"] > li', { hasText: 'Quick stop' })
  const fullCard = column.locator('[data-testid="card-list"] > li', { hasText: 'All day tour' })

  const defaultBox = await defaultCard.getByTestId('card').boundingBox()
  const fullBox = await fullCard.getByTestId('card').boundingBox()
  expect(defaultBox).not.toBeNull()
  expect(fullBox).not.toBeNull()
  // 15h window → 900px vs the 60px default block.
  expect(fullBox!.height).toBe(defaultBox!.height * 15)
})
