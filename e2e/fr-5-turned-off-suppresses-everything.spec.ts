import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, mockOpenRouter, moveCaret, snapshot } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-26: Turning continuation off suppresses every continuation, and no request is issued', async ({
  page,
}) => {
  const paragraphOne = 'The cabin sat quiet under the first snow, and'
  const paragraphTwo = 'The road below had gone under too, and'
  const paragraphThree = 'By evening nothing moved at all, and'
  const doc = `${paragraphOne}\n\n${paragraphTwo}\n\n${paragraphThree}`

  const mock = await mockOpenRouter(page, { continuation: ' the kettle went on.' })

  const toggle = page.locator('button[aria-label="Predictions"]')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  // The off state is what is persisted, not merely what is rendered.
  const stored = await page.evaluate(() => localStorage.getItem('chiri-settings'))
  expect(JSON.parse(stored ?? '{}').continuationEnabled).toBe(false)

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  await page.waitForTimeout(PAST_SETTLE_MS)
  const before = mock.continuationCount()

  // Pause at the end of each paragraph in turn. Every one of these is an
  // eligible position that would offer a continuation with the setting on.
  const pausePoints = [
    paragraphOne.length,
    `${paragraphOne}\n\n${paragraphTwo}`.length,
    doc.length,
  ]

  for (const offset of pausePoints) {
    await moveCaret(page, offset)
    await page.waitForTimeout(PAST_SETTLE_MS)

    const state = await snapshot(page)
    expect(state.ghost, `ghost at offset ${offset}`).toBeNull()
    expect(state.ghostWidgets, `painted ghost at offset ${offset}`).toBe(0)
  }

  expect(mock.continuationCount(), 'requests issued while predictions are off').toBe(before)
  expect((await snapshot(page)).doc).toBe(doc)
})
