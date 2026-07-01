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
 * Add a city and wait for its row to appear. Cities are still an inline section
 * in Phase-2 Task 3; Task 4 moves them behind a `[◉ Cities]` modal — update the
 * open/close here then, and every caller stays unchanged.
 */
export async function addCity(page: Page, name: string) {
  await page.getByLabel('New city name').fill(name)
  await page.getByRole('button', { name: 'Add city' }).click()
  await expect(page.getByLabel(`Name for ${name}`)).toHaveValue(name)
}
