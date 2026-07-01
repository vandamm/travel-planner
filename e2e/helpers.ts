import { expect, type Page } from '@playwright/test'

/**
 * Open the `[✎ Trip]` header pop-over, fill the given trip fields (live writes),
 * and close it. Centralises the inline→modal churn so specs that only need a
 * set-up trip as a precondition don't each re-encode the modal flow.
 */
export async function setupTrip(
  page: Page,
  { title, startDate, numDays }: { title?: string; startDate?: string; numDays?: number | string },
) {
  await page.getByRole('button', { name: 'Trip' }).click()
  const dialog = page.getByRole('dialog', { name: 'Trip details' })
  if (title !== undefined) await dialog.getByLabel('Trip title').fill(title)
  if (startDate !== undefined) await dialog.getByLabel('Start date').fill(startDate)
  if (numDays !== undefined) await dialog.getByLabel('Number of days').fill(String(numDays))
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toHaveCount(0)
}

/**
 * Open the `[◉ Cities]` header pop-over, add a city, wait for its row, then close
 * — so the board underneath stays interactable for the caller. Centralises the
 * inline→modal churn; specs that need to keep the modal open (e.g. to remove a
 * city) open it themselves.
 */
export async function addCity(page: Page, name: string) {
  await page.getByRole('button', { name: 'Cities' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cities & colours' })
  await dialog.getByLabel('New city name').fill(name)
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect(dialog.getByLabel(`Name for ${name}`)).toHaveValue(name)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
}
