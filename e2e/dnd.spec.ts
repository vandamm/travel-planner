import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Drag dnd-kit's grab handle onto a target with explicit, stepped pointer moves
 * and short pauses. dnd-kit's PointerSensor needs real intermediate pointer
 * events (and our 4px activation threshold met) before it begins a drag, and its
 * `closestCenter` collision needs the pointer to settle over the target — both
 * of which Playwright's high-level `dragTo` does not reliably produce.
 */
async function dragHandleOnto(page: Page, handle: Locator, target: Locator) {
  const from = await handle.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('missing bounding box for drag')

  const sx = from.x + from.width / 2
  const sy = from.y + from.height / 2
  const tx = to.x + to.width / 2
  const ty = to.y + to.height / 2

  await page.mouse.move(sx, sy)
  await page.mouse.down()
  // Clear the activation distance, travel to the target, then settle on it.
  await page.mouse.move(sx, sy + 10, { steps: 5 })
  await page.mouse.move(tx, ty - 20, { steps: 15 })
  await page.waitForTimeout(100)
  await page.mouse.move(tx, ty + 10, { steps: 10 })
  await page.waitForTimeout(100)
  await page.mouse.move(tx, ty)
  await page.waitForTimeout(100)
  await page.mouse.up()
}

test('drag a card to another day column', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Trip title').fill('Italy 2027')
  await page.getByLabel('Start date').fill('2027-05-01')
  await page.getByLabel('Number of days').fill('3')

  const columns = page.locator('[data-testid="day-column"]')
  const firstColumn = columns.nth(0)
  const secondColumn = columns.nth(1)

  // Add one card to the first day.
  await firstColumn.getByRole('button', { name: /Add card/ }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('Museum')
  await editor.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-title')).toHaveText('Museum')
  await expect(secondColumn.getByTestId('card-title')).toHaveCount(0)

  // Drag it onto the (empty) second column.
  const handle = firstColumn.getByRole('button', { name: 'Drag Museum' })
  await dragHandleOnto(page, handle, secondColumn)

  await expect(secondColumn.getByTestId('card-title')).toHaveText('Museum')
  await expect(firstColumn.getByTestId('card-title')).toHaveCount(0)
})

test('reorder untimed cards within a day', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Trip title').fill('Italy 2027')
  await page.getByLabel('Start date').fill('2027-05-01')
  await page.getByLabel('Number of days').fill('3')

  const firstColumn = page.locator('[data-testid="day-column"]').first()

  for (const title of ['First', 'Second', 'Third']) {
    await firstColumn.getByRole('button', { name: /Add card/ }).click()
    const editor = page.getByRole('dialog', { name: 'Card editor' })
    await editor.getByLabel('Card title').fill(title)
    await editor.getByRole('button', { name: 'Save card' }).click()
  }

  const titles = firstColumn.getByTestId('card-title')
  await expect(titles).toHaveText(['First', 'Second', 'Third'])

  // Drag the first card down onto the third; it lands in the third card's slot.
  const handle = firstColumn.getByRole('button', { name: 'Drag First' })
  const thirdCard = firstColumn.getByTestId('card').nth(2)
  await dragHandleOnto(page, handle, thirdCard)

  await expect(titles).toHaveText(['Second', 'First', 'Third'])
})
