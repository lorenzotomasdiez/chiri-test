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
  // The selected phrase deliberately ends where the paragraph ends, so the
  // selection's head sits at an otherwise perfectly eligible position. A
  // phrase selected mid-line would be refused by the end-of-paragraph rule
  // on its own, and this test would then pass with the selection check
  // deleted - which is exactly what it did before this was fixed.
  const selected = 'first snow'
  const doc = `The cabin sat quiet under the ${selected}`

  const mock = await mockOpenRouter(page, { continuation: ' of the season.' })

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  await page.waitForTimeout(PAST_SETTLE_MS)
  const before = mock.continuationCount()

  // A selection means the writer is acting on text that already exists,
  // which is the one thing continuation never speaks to.
  await page.evaluate(
    ({ text, phrase }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      const from = text.indexOf(phrase)
      editor.dispatch({ selection: { anchor: from, head: from + phrase.length } })
    },
    { text: doc, phrase: selected },
  )

  // The head of that selection is at the end of the paragraph - the check
  // below is about the selection, not about where the caret landed.
  expect(doc.indexOf(selected) + selected.length).toBe(doc.length)

  await page.waitForTimeout(PAST_SETTLE_MS)

  expect(mock.continuationCount(), 'continuation requests issued while selecting').toBe(before)

  const state = await snapshot(page)
  expect(state.ghost).toBeNull()
  expect(state.ghostWidgets).toBe(0)
  expect(state.doc).toBe(doc)
})
