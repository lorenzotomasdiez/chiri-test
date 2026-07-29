import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, mockOpenRouter, snapshot } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-20: A failed request shows nothing and does not interrupt typing', async ({ page }) => {
  const initialDoc = 'The cabin sat quiet under the first snow of the season, and'
  const keptTyping = ' the road out was gone.'

  const mock = await mockOpenRouter(page, { failContinuation: true })

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)

  // Let the request go out and fail.
  await page.waitForTimeout(PAST_SETTLE_MS)
  expect(mock.continuationCount(), 'the request should have been attempted').toBeGreaterThan(0)

  // Nothing appears, and nothing interrupts. A failed prediction is a
  // prediction the writer never asked for and must never be told about.
  const afterFailure = await snapshot(page)
  expect(afterFailure.ghost).toBeNull()
  expect(afterFailure.ghostWidgets).toBe(0)
  expect(afterFailure.doc).toBe(initialDoc)

  await expect(page.locator('[role="alert"]')).toHaveCount(0)
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)

  // The editor is still the editor: typing continues exactly where it left off.
  await page.keyboard.type(keptTyping)
  const afterTyping = await snapshot(page)
  expect(afterTyping.doc).toBe(initialDoc + keptTyping)
  expect(afterTyping.caret).toBe((initialDoc + keptTyping).length)

  expect(pageErrors, 'a failed continuation must not surface as an uncaught error').toEqual([])
})
