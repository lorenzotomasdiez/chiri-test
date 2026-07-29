import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, mockOpenRouter, snapshot } from './continuation'
import type { EditorView } from '@codemirror/view'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-13: No continuation is requested or shown while a selection is active', async ({
  page,
}) => {
  const doc = 'The cabin sat quiet under the first snow of the season, and'

  const mock = await mockOpenRouter(page, { continuation: ' the road out had vanished.' })

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  await page.waitForTimeout(PAST_SETTLE_MS)
  const before = mock.continuationCount()

  // Select `first snow`. A selection means the writer is acting on text that
  // already exists, which is the one thing continuation never speaks to.
  await page.evaluate((text) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const from = text.indexOf('first snow')
    editor.dispatch({ selection: { anchor: from, head: from + 'first snow'.length } })
  }, doc)

  await page.waitForTimeout(PAST_SETTLE_MS)

  expect(mock.continuationCount(), 'continuation requests issued while selecting').toBe(before)

  const state = await snapshot(page)
  expect(state.ghost).toBeNull()
  expect(state.ghostWidgets).toBe(0)
  expect(state.doc).toBe(doc)
})
