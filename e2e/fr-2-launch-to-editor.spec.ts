import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test('T-FR-2-6: readiness with a stored valid key transitions to the editor (AC-2.2, AC-2.3, AC-1.8)', async ({
  page,
}) => {
  await seedValidatedKey(page)

  // AC-1.8: a stored key is trusted at boot without re-validation, so count and
  // abort any OpenRouter requests to verify none are made.
  let openrouterRequestCount = 0
  await page.route('https://openrouter.ai/**', (route) => {
    openrouterRequestCount++
    route.abort()
  })

  await page.goto('/')

  // AC-2.1: the launch state begins with the splash visible
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  // AC-2.2 (ready fires before dwell ends) and AC-2.3 (editor when key is stored):
  // wait for the splash to disappear, then verify the editor is shown
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)

  // The banner (top bar) and editor content are now visible
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.locator('.cm-content')).toBeVisible()

  // AC-2.3: a stored valid key means the editor is next, not the key gate
  await expect(page.getByTestId('key-gate-modal')).toHaveCount(0)

  // AC-1.8: stored key is trusted at boot, no network requests to OpenRouter
  expect(openrouterRequestCount).toBe(0)
})
