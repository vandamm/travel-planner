import { expect, test } from '@playwright/test'
import { pickTime, setupTrip, E2E_LINK } from './helpers'

test('undo removes a hand-added card; redo restores it', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const firstColumn = page.locator('[data-testid="day-column"]').first()

  // Create a card by hand — this is what the undo stack should track.
  await firstColumn.getByRole('button', { name: /Add card/ }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('Visit Colosseum')
  await editor.getByLabel('Set a time').check()
  await pickTime(editor, 'Start time', '10:00')
  await editor.getByRole('button', { name: 'Save card' }).click()
  await expect(firstColumn.getByTestId('card-title')).toHaveText('Visit Colosseum')

  // Undo via the toolbar button → the card is gone.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(firstColumn.getByTestId('card-title')).toHaveCount(0)

  // Redo → the card is back.
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(firstColumn.getByTestId('card-title')).toHaveText('Visit Colosseum')

  // Keyboard also drives it: Cmd/Ctrl+Z undoes again.
  await page.keyboard.press('ControlOrMeta+z')
  await expect(firstColumn.getByTestId('card-title')).toHaveCount(0)
})
