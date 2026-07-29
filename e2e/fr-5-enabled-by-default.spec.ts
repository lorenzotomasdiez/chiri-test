import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { ghostText, mockOpenRouter, waitForGhost } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-25: Continuation prediction is active by default on a first-ever session', async ({
  page,
}) => {
  const doc = 'The cabin sat quiet under the first snow of the season, and'
  const continuation = ' the road out had already vanished.'

  // The only thing on file is the API key the gate requires. Nothing has ever
  // set continuationEnabled, which is the whole point: the default has to
  // come from the absence of a stored preference, not from a stored `true`.
  const storedBefore = await page.evaluate(() => localStorage.getItem('chiri-settings'))
  expect(JSON.parse(storedBefore ?? '{}')).not.toHaveProperty('continuationEnabled')

  await expect(page.locator('button[aria-label="Predictions"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  // No settings were opened and nothing was toggled between boot and here.
  await waitForGhost(page)
  expect(await ghostText(page)).toBe(continuation)
})
