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

test('T-FR-3-9: Undo and redo form one ordered history across human and AI-origin edits', async ({
  page,
}) => {
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

  // User types first line
  await page.locator('.cm-content').click()
  await page.keyboard.type('First line.')

  // AI appends second part as a single transaction
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({
      changes: {
        from: editor.state.doc.length,
        insert: ' Second part.',
      },
    })
  })

  // User types third line
  await page.keyboard.type(' Third line.')

  expect(await docText(page)).toBe('First line. Second part. Third line.')

  // First undo: remove user's third line
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('First line. Second part.')

  // Second undo: remove AI's second part
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('First line.')

  // Third undo: remove user's first line
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('')
})
