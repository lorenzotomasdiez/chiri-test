import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-3-11: a new edit after an undo clears the redo stack', async ({ page }) => {
  await page.locator('.cm-content').click()

  await page.keyboard.type('Draft one.')
  expect(await docText(page)).toBe('Draft one.')

  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('')

  // Type instead of redoing. This is the branch point: the redo that was
  // available a moment ago now describes a history that no longer exists.
  await page.keyboard.type('Draft two.')
  expect(await docText(page)).toBe('Draft two.')

  await page.keyboard.press(`${mod}+Shift+z`)

  // "Draft one." must not come back, and it must not be spliced into or
  // appended onto the new text either - the branch is gone, not relocated.
  expect(await docText(page)).toBe('Draft two.')

  // A second redo is equally inert rather than resurrecting it one step later.
  await page.keyboard.press(`${mod}+Shift+z`)
  expect(await docText(page)).toBe('Draft two.')

  // Undo still walks the surviving branch, so clearing the redo stack did
  // not corrupt the history it was attached to.
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('')
})
