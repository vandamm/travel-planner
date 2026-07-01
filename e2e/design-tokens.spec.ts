import { expect, test } from '@playwright/test'

// Task 1 tokens: screen title uses Lora (serif), body text uses Manrope (sans).
test('title renders in Lora, body in Manrope', async ({ page }) => {
  await page.goto('/')

  const title = page.getByRole('heading', { name: 'Travel Planner' })
  await expect(title).toBeVisible()

  const titleFont = await title.evaluate((el) => getComputedStyle(el).fontFamily)
  expect(titleFont).toContain('Lora')

  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  expect(bodyFont).toContain('Manrope')
})
