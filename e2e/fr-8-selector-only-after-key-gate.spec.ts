import { test, expect } from '@playwright/test'
import { SEEDED_API_KEY } from './seed'

test('T-FR-8-2: The selector is reachable inside the document surface, and only after the key gate', async ({
  page,
}) => {
  // Part 1: Without a stored key, the key gate is shown and selector is not reachable
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload()

  // Wait for the launch splash to complete (it appears then disappears)
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)

  // Key gate modal should be visible
  await expect(page.getByTestId('key-gate-modal')).toBeVisible()

  // Model selector trigger should not be present or reachable
  await expect(page.locator('[data-testid="model-selector-trigger"]')).toHaveCount(0)

  // Part 2: With a seeded valid key, the selector is visible and reachable
  // Set localStorage with a valid API key before reloading
  await page.evaluate(
    ([key, apiKey]) => {
      localStorage.setItem(key, JSON.stringify({ apiKey }))
    },
    ['chiri-settings', SEEDED_API_KEY] as const,
  )
  await page.reload()

  // Wait for the editor to be visible (ensures key gate is passed and app is loaded)
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // Model selector trigger should now be visible in the top bar
  const trigger = page.locator('[data-testid="model-selector-trigger"]')
  await expect(trigger).toBeVisible()

  // Verify trigger is inside the top bar (header with role="banner")
  const header = page.locator('header[role="banner"]')
  await expect(header).toBeVisible()

  // Click the trigger to open the panel
  await trigger.click()

  // Panel should open
  const panel = page.locator('[data-testid="model-selector-panel"]')
  await expect(panel).toBeVisible()

  // Editor content should still be in the DOM (no navigation away)
  await expect(page.locator('[data-testid="editor"] .cm-content')).toBeVisible()
})
