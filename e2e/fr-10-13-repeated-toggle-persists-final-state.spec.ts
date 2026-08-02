import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-10-13: Repeated toggling of the setting persists only the final state', async ({
  page,
}) => {
  const toggle = page.locator('button[aria-label="Predictions"]')

  // Starts on (the default). Off, back on, then off again in quick
  // succession - only the last of these three writes should survive.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // The persisted value must match the last change made before reload, not
  // some earlier intermediate state a debounced or batched write might have
  // left behind.
  await expect(page.locator('button[aria-label="Predictions"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})
