import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, ghostWidgetCount, mockOpenRouter, snapshot } from './continuation'
import type { EditorView } from '@codemirror/view'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-12: No continuation is requested or shown inside a fenced code block', async ({
  page,
}) => {
  const doc = 'Some prose first.\n\n```\nconst x = 1;'

  const mock = await mockOpenRouter(page, { continuation: ' const y = 2;' })

  // Set the document in one transaction rather than typing it. Typing walks
  // through intermediate states - a lone backtick is not yet a fence - and
  // this scenario is about the pause, not about what the debounce did while
  // the fence was still being typed.
  await page.locator('.cm-content').click()
  await page.evaluate((text) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text },
      selection: { anchor: text.length },
    })
  }, doc)

  // Baseline after the document settles, so the count below measures only
  // what the pause inside the fence caused.
  await page.waitForTimeout(PAST_SETTLE_MS)
  const before = mock.continuationCount()

  // Nudge the caret to the end of the code line and pause there.
  await page.keyboard.press('End')
  await page.waitForTimeout(PAST_SETTLE_MS)

  expect(mock.continuationCount(), 'continuation requests issued from inside the fence').toBe(
    before,
  )
  expect(await ghostWidgetCount(page)).toBe(0)

  const state = await snapshot(page)
  expect(state.ghost).toBeNull()
  expect(state.doc).toBe(doc)
})
