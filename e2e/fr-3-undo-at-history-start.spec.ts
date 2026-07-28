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

test('T-FR-3-10: undo at the start of the history has no effect', async ({ page }) => {
  await page.locator('.cm-content').click()

  // A freshly opened document, no edits made in this session.
  expect(await docText(page)).toBe('')

  await page.keyboard.press(`${mod}+z`)

  // Unchanged, and nothing surfaced to the user about it.
  expect(await docText(page)).toBe('')
  expect(await page.locator('[role="alert"]').count()).toBe(0)

  // Repeated invocations stay a no-op rather than degrading into one.
  await page.keyboard.press(`${mod}+z`)
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('')
  expect(await page.locator('[role="alert"]').count()).toBe(0)

  // The surface is still live afterwards - a dead-ended history must not
  // have cost the editor its ability to take the next keystroke.
  await page.keyboard.type('Still writing.')
  expect(await docText(page)).toBe('Still writing.')
})
