import { expect, test } from '@playwright/test'

test('create, edit, and delete an activity card on the board', async ({ page }) => {
  await page.goto('/')

  // A trip with days, so the board renders columns to drop cards into.
  await page.getByLabel('Trip title').fill('Italy 2027')
  await page.getByLabel('Start date').fill('2027-05-01')
  await page.getByLabel('Number of days').fill('3')

  const firstColumn = page.locator('[data-testid="day-column"]').first()

  // Create a card on the first day.
  await firstColumn.getByRole('button', { name: /Add card/ }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('Visit Colosseum')
  await editor.getByLabel('Set a time').check()
  await editor.getByLabel('Start time').fill('10:00')
  await editor.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-title')).toHaveText('Visit Colosseum')
  await expect(firstColumn.getByTestId('card-time')).toHaveText('10:00')

  // Edit the card.
  await firstColumn.getByRole('button', { name: 'Edit Visit Colosseum' }).click()
  const editAgain = page.getByRole('dialog', { name: 'Card editor' })
  await expect(editAgain.getByLabel('Card title')).toHaveValue('Visit Colosseum')
  await editAgain.getByLabel('Card title').fill('Visit the Forum')
  await editAgain.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-title')).toHaveText('Visit the Forum')

  // Delete the card.
  await firstColumn.getByRole('button', { name: 'Edit Visit the Forum' }).click()
  await page.getByRole('dialog', { name: 'Card editor' }).getByRole('button', { name: 'Delete card' }).click()

  await expect(firstColumn.getByTestId('card-title')).toHaveCount(0)
})
