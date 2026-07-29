import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, ghostText, mockOpenRouter, snapshot, waitForGhost } from './continuation'
import type { EditorView } from '@codemirror/view'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-30: A shown continuation is suppressed while text is selected anywhere', async ({
  page,
}) => {
  // The phrase selected below ends where the paragraph ends, so the resulting
  // selection head is at an otherwise eligible position. Selecting mid-line
  // instead would leave this passing on the end-of-paragraph rule alone, with
  // the selection check contributing nothing.
  const selected = 'first snow'
  const doc = `The cabin sat quiet under the ${selected}`
  const continuation = ' of the season.'

  const mock = await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  await waitForGhost(page)
  expect(await ghostText(page)).toBe(continuation)

  const before = mock.continuationCount()

  // Select back over text already written. The offer belongs to a writer who
  // was writing forward; a writer who has started selecting is doing
  // something else.
  await page.evaluate(
    ({ text, phrase }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      const from = text.indexOf(phrase)
      editor.dispatch({ selection: { anchor: from, head: from + phrase.length } })
    },
    { text: doc, phrase: selected },
  )

  // Immediately, not eventually: the offer is gone the moment the selection exists.
  const afterSelect = await snapshot(page)
  expect(afterSelect.ghost).toBeNull()
  expect(afterSelect.ghostWidgets).toBe(0)
  expect(afterSelect.doc).toBe(doc)

  // And nothing new is requested for as long as the selection stands.
  await page.waitForTimeout(PAST_SETTLE_MS)
  expect(mock.continuationCount(), 'requests issued while a selection stands').toBe(before)

  const settled = await snapshot(page)
  expect(settled.ghost).toBeNull()
  expect(settled.ghostWidgets).toBe(0)
  expect(settled.doc).toBe(doc)
})
