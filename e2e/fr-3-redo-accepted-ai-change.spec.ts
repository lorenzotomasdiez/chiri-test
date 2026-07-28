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

test('T-FR-3-6: Redoing a reverted accepted AI change reapplies it', async ({ page }) => {
  // Type the initial text
  await page.locator('.cm-content').click()
  await page.keyboard.type('The quick fox jumps.')

  expect(await docText(page)).toBe('The quick fox jumps.')

  // Dispatch a transaction to replace the text (simulating an accept)
  await page.evaluate(() => {
    const editor = (window as unknown as Record<string, any>).__editor
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: 'The quick brown fox leaps swiftly.',
      },
    })
  })

  expect(await docText(page)).toBe('The quick brown fox leaps swiftly.')

  // Undo the accept transaction
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('The quick fox jumps.')

  // Redo the accept transaction
  await page.keyboard.press(`${mod}+Shift+z`)
  expect(await docText(page)).toBe('The quick brown fox leaps swiftly.')
})
