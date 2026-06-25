import { expect, test } from '@playwright/test'

test('add an accommodation and see day headers recolor', async ({ page }) => {
  await page.goto('/')

  // A trip with days plus a city to assign the stay to.
  await page.getByLabel('Trip title').fill('Italy 2027')
  await page.getByLabel('Start date').fill('2027-05-01')
  await page.getByLabel('Number of days').fill('4')

  await page.getByLabel('New city name').fill('Rome')
  await page.getByRole('button', { name: 'Add city' }).click()
  await expect(page.getByLabel('Name for Rome')).toHaveValue('Rome')

  const columns = page.locator('[data-testid="day-column"]')
  const firstBand = columns.nth(0).getByTestId('city-band')
  // No covering stay yet → neutral band color.
  await expect(firstBand).toHaveCSS('background-color', 'rgb(203, 213, 225)') // slate-300

  // Add a stay covering the first two nights, in Rome.
  await page.getByRole('button', { name: 'Add stay' }).click()
  const editor = page.getByRole('dialog', { name: 'Accommodation editor' })
  await editor.getByLabel('Accommodation label').fill('Hotel Roma')
  await editor.getByLabel('City').selectOption({ label: 'Rome' })
  await editor.getByLabel('First night').fill('2027-05-01')
  await editor.getByLabel('Last night').fill('2027-05-02')
  await editor.getByRole('button', { name: 'Save stay' }).click()

  // The bar shows up in the lane…
  await expect(page.getByTestId('accommodation-bar')).toHaveText('Hotel Roma')

  // …and the first two day headers now carry Rome's color (the default new-city
  // blue, since we didn't pick one), while the third stays neutral.
  await expect(firstBand).toHaveCSS('background-color', 'rgb(59, 130, 246)') // #3b82f6
  await expect(columns.nth(0).getByTestId('city-name')).toHaveText('Rome')
  await expect(columns.nth(1).getByTestId('city-band')).toHaveCSS('background-color', 'rgb(59, 130, 246)')
  await expect(columns.nth(2).getByTestId('city-band')).toHaveCSS('background-color', 'rgb(203, 213, 225)')

  // Editing the stay from its bar updates the label live.
  await page.getByTestId('accommodation-bar').click()
  const editAgain = page.getByRole('dialog', { name: 'Accommodation editor' })
  await editAgain.getByLabel('Accommodation label').fill('Hotel Roma Centro')
  await editAgain.getByRole('button', { name: 'Save stay' }).click()
  await expect(page.getByTestId('accommodation-bar')).toHaveText('Hotel Roma Centro')
})
