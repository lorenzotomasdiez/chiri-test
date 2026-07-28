import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test.beforeEach(async ({ page, context }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-4-13: The document loads, stays editable, and keeps saving with no network', async ({
  page,
  context,
}) => {
  // First visit: create and save a document while online
  await page.locator('.cm-content').click()
  await page.keyboard.type('Saved while online.')

  // Wait for auto-save to complete (debounce + safety margin)
  await page.waitForTimeout(2000)

  // Verify the document was saved
  expect(await docText(page)).toBe('Saved while online.')

  // Go offline and reload
  await context.setOffline(true)
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // Verify the document loads after offline reload
  expect(await docText(page)).toBe('Saved while online.')

  // Verify the editor is editable
  const editorContent = page.locator('.cm-content')
  await expect(editorContent).toBeFocused()

  // Type additional content while offline
  await page.keyboard.type(' Written while offline.')

  // Wait for auto-save to complete while still offline
  await page.waitForTimeout(2000)

  // Reload the page while still offline to verify persistence
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // Verify the complete document persists across offline reload
  expect(await docText(page)).toBe('Saved while online. Written while offline.')
})
