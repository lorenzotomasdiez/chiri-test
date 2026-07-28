import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-3-5: Undoing an accepted AI change reverts it as a single unit', async ({
  page,
}) => {
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

  // Type the initial user content
  await page.locator('.cm-content').click()
  await page.keyboard.type('The quick fox jumps.')

  // Verify initial content
  expect(await docText(page)).toBe('The quick fox jumps.')

  // Simulate AI revision being applied through a single transaction,
  // exactly as an FR-6 accept commits it
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const doc = editor.state.doc
    editor.dispatch({
      changes: {
        from: 0,
        to: doc.length,
        insert: 'The quick brown fox leaps swiftly.',
      },
    })
  })

  // Verify the AI change was applied
  expect(await docText(page)).toBe('The quick brown fox leaps swiftly.')

  // Undo once - should revert to the pre-accept string
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('The quick fox jumps.')

  // Undo a second time - should take the document to empty,
  // proving the reversion took exactly one undo step, not one per word
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('')
})
