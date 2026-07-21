import { expect, test } from '@playwright/test'
import { addActivity, pickTime, setupTrip, E2E_LINK } from './helpers'

test('create, edit, and delete an activity card on the board', async ({ page }) => {
  await page.goto(E2E_LINK)

  // A trip with days, so the board renders columns to drop cards into.
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const firstColumn = page.locator('[data-testid="day-column"]').first()

  // Create a card on the first day.
  await addActivity(firstColumn)
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Title').fill('Visit Colosseum')
  await pickTime(editor, 'Start time', '10:00')
  await editor.getByRole('button', { name: 'Transit' }).click()
  await editor.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-title')).toHaveText('Visit Colosseum')
  await expect(firstColumn.getByTestId('card-time')).toHaveText('10:00 · 1h 00m')
  const titleRow = firstColumn.getByTestId('card-title-row')
  await expect(titleRow).toHaveClass(/flex-wrap/)
  await expect(titleRow.getByTestId('card-title')).toHaveText('Visit Colosseum')
  await expect(titleRow.getByTestId('card-category')).toHaveText('transit')

  // The free-time target after a positioned card remains directly clickable.
  await firstColumn.getByTestId('timeline-slot').last().click()
  await expect(page.getByRole('dialog', { name: 'Card editor' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Edit the card.
  await firstColumn
    .getByTestId('card')
    .getByRole('button', { name: 'Edit Visit Colosseum', exact: true })
    .click()
  const editAgain = page.getByRole('dialog', { name: 'Card editor' })
  await expect(editAgain.getByLabel('Title')).toHaveValue('Visit Colosseum')
  await editAgain.getByLabel('Title').fill('Visit the Forum')
  await editAgain.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-title')).toHaveText('Visit the Forum')

  // Delete the card.
  await firstColumn
    .getByTestId('card')
    .getByRole('button', { name: 'Edit Visit the Forum', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Card editor' })
    .getByRole('button', { name: 'Delete card' })
    .click()

  await expect(firstColumn.getByTestId('card-title')).toHaveCount(0)
})
