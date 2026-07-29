import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
  })
  await page.goto('/')
})

test('T-CC-TYPE-1: key gate input carries the single Inter interface family, not a second monospace family', async ({
  page,
}) => {
  const input = page.getByTestId('key-gate-modal').getByLabel('OpenRouter API key')
  await expect(input).toBeVisible()

  const fontFamily = await input.evaluate((el) => getComputedStyle(el).fontFamily)

  // CC-TYPE.1/CC-TYPE.2: a single family, Inter, carries the interface - no
  // second family anywhere outside CC-DOC.8's document-code carve-out, which
  // this form input is not. Assert Inter leads the stack and no monospace
  // fallback keyword sneaks in ahead of it.
  expect(fontFamily.toLowerCase()).toContain('inter')
  expect(fontFamily.toLowerCase()).not.toContain('monospace')
})
