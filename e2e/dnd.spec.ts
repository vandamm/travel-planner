import { expect, test, type Locator, type Page } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

async function openLocalBoard(page: Page) {
  await page.route('**/api/auth', (route) => route.fulfill({ status: 503 }))
  await page.goto(E2E_LINK)
}

/**
 * Drag dnd-kit's whole-card surface onto a target with explicit, stepped pointer moves
 * and short pauses. dnd-kit's PointerSensor needs real intermediate pointer
 * events (and our 4px activation threshold met) before it begins a drag, and its
 * `closestCenter` collision needs the pointer to settle over the target — both
 * of which Playwright's high-level `dragTo` does not reliably produce.
 */
async function dragSurfaceOnto(page: Page, surface: Locator, target: Locator) {
  // The configurable day window makes columns tall, so the first card can sit
  // above the viewport top — scroll the handle in before reading its box, or the
  // drag starts at a clamped (off-screen) point and never activates.
  await surface.scrollIntoViewIfNeeded()
  const from = await surface.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('missing bounding box for drag')

  const sx = from.x + from.width / 2
  const sy = from.y + from.height / 2
  const tx = to.x + to.width / 2
  const ty = to.y + to.height / 2

  await page.mouse.move(sx, sy)
  await page.mouse.down()
  // Clear the activation distance, then descend to the target in one smooth run
  // and settle there. A zig-zag approach makes closestCenter oscillate between a
  // tall card and its reflowed neighbour and can settle on the wrong slot, so we
  // travel straight to the center and pause long enough for the reflow to settle.
  await page.mouse.move(sx, sy + 10, { steps: 5 })
  await page.mouse.move(tx, ty, { steps: 20 })
  await page.waitForTimeout(200)
  await page.mouse.move(tx, ty + 1, { steps: 2 })
  await page.waitForTimeout(200)
  await page.mouse.up()
}

test('drag a card to another day column', async ({ page }) => {
  await openLocalBoard(page)

  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const columns = page.locator('[data-testid="day-column"]')
  const firstColumn = columns.nth(0)
  const secondColumn = columns.nth(1)

  // Add one card to the first day.
  await firstColumn.getByRole('button', { name: 'Add activity', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Title').fill('Museum')
  await editor.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-title')).toHaveText('Museum')
  await expect(secondColumn.getByTestId('card-title')).toHaveCount(0)

  // Drag it onto the (empty) second column.
  const surface = firstColumn.locator('[data-testid="card"]', { hasText: 'Museum' })
  await dragSurfaceOnto(page, surface, secondColumn)

  await expect(secondColumn.getByTestId('card-title')).toHaveText('Museum')
  await expect(firstColumn.getByTestId('card-title')).toHaveCount(0)
})

test('dragged card previews its timing and highlights the target day', async ({ page }) => {
  await openLocalBoard(page)

  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const columns = page.locator('[data-testid="day-column"]')
  const firstColumn = columns.nth(0)
  const secondColumn = columns.nth(1)

  await firstColumn.getByRole('button', { name: 'Add activity', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Title').fill('Museum')
  await editor.getByRole('button', { name: 'Save card' }).click()

  // Begin a drag and pause with the pointer over the second column — without
  // releasing — to observe the live overlay + drop-target hint.
  const surface = firstColumn.locator('[data-testid="card"]', { hasText: 'Museum' })
  await surface.scrollIntoViewIfNeeded()
  const from = await surface.boundingBox()
  const to = await secondColumn.boundingBox()
  if (!from || !to) throw new Error('missing bounding box for drag')
  const sx = from.x + from.width / 2
  const sy = from.y + from.height / 2
  const tx = to.x + to.width / 2
  const ty = to.y + to.height / 2

  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx, sy + 10, { steps: 5 })
  await page.mouse.move(tx, ty, { steps: 15 })
  await page.waitForTimeout(150)

  // The source stays mounted but invisible while one live card preview marks its placement.
  await expect(
    page.locator('[data-testid="card-title"]:visible').filter({ hasText: 'Museum' }),
  ).toHaveCount(1)
  await expect(page.locator('[data-testid="drag-preview-card"]:visible')).toHaveCount(1)
  await expect(secondColumn).toHaveAttribute('data-drag-over', '')

  await page.mouse.up()

  // After dropping, the overlay is gone and the card lives on the second day.
  await expect(page.getByTestId('card-title')).toHaveCount(1)
  await expect(secondColumn.getByTestId('card-title')).toHaveText('Museum')
  await expect(secondColumn).not.toHaveAttribute('data-drag-over', '')
})

test('dropping an untimed card within a day assigns its timeline time', async ({ page }) => {
  await openLocalBoard(page)

  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const firstColumn = page.locator('[data-testid="day-column"]').first()

  for (const title of ['First', 'Second', 'Third']) {
    await firstColumn.getByRole('button', { name: 'Add activity', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Card editor' })
    await editor.getByLabel('Title').fill(title)
    await editor.getByRole('button', { name: 'Save card' }).click()
  }

  const titles = firstColumn.getByTestId('card-title')
  await expect(titles).toHaveText(['First', 'Second', 'Third'])

  // Drag the first card down onto the third; its dropped top lands at 08:00.
  const surface = firstColumn.locator('[data-testid="card"]', { hasText: 'First' })
  const thirdCard = firstColumn.getByTestId('card').nth(2)
  await dragSurfaceOnto(page, surface, thirdCard)

  const firstCard = firstColumn.locator('[data-testid="card"]', { hasText: 'First' })
  await expect(firstCard.getByTestId('card-time')).toHaveText(/08:(00|30) · 1h/)
})
