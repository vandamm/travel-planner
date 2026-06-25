import { expect, test } from '@playwright/test'

test('set up a trip and add a city', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Trip title').fill('Italy 2027')
  await page.getByLabel('Start date').fill('2027-05-01')
  await page.getByLabel('Number of days').fill('10')

  await expect(page.getByLabel('Trip title')).toHaveValue('Italy 2027')
  await expect(page.getByLabel('Number of days')).toHaveValue('10')

  await page.getByLabel('New city name').fill('Rome')
  await page.getByRole('button', { name: 'Add city' }).click()

  await expect(page.getByLabel('Name for Rome')).toHaveValue('Rome')

  await page.getByLabel('New city name').fill('Florence')
  await page.getByRole('button', { name: 'Add city' }).click()

  await expect(page.getByLabel('Name for Florence')).toHaveValue('Florence')

  await page.getByRole('button', { name: 'Remove Rome' }).click()
  await expect(page.getByLabel('Name for Rome')).toHaveCount(0)
})
