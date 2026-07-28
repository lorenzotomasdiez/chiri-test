import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test.beforeEach(async ({ page }) => {
  // Clear localStorage before the app boots, so it behaves as first launch.
  await page.addInitScript(() => {
    localStorage.clear()
  })
  await page.goto('/')
})

test('T-FR-1-1: First launch with no stored key blocks the editor', async ({ page }) => {
  // Wait for the key modal to be visible.
  await page.waitForSelector('[data-testid="key-gate-modal"]')
  await expect(page.getByTestId('key-gate-modal')).toBeVisible()

  // Clicking the CodeMirror surface leaves activeElement outside the editor.
  // The click is forced past the gate card that now covers the centre of the
  // column: the point of AC-1.1 is that the editor itself refuses input
  // because it is inert, not that an overlay happens to be in the way. A click
  // delivered straight to the surface is the stronger assertion, and it is
  // what the modal's pointer-events-none backdrop is designed to allow.
  await page.locator('.cm-content').click({ force: true })
  const activeElement = await page.evaluate(() => {
    const active = document.activeElement
    if (!active) return 'null'
    const cmContent = document.querySelector('.cm-content')
    return cmContent?.contains(active) ? 'inside-editor' : 'outside-editor'
  })
  expect(activeElement).toBe('outside-editor')

  // Typing 'hello' after that click leaves the document empty.
  await page.keyboard.type('hello')
  expect(await docText(page)).toBe('')

  // Pressing Tab from the modal never moves focus into .cm-content.
  const modal = page.getByTestId('key-gate-modal')
  await modal.focus()
  await page.keyboard.press('Tab')
  const focusAfterTab = await page.evaluate(() => {
    const active = document.activeElement
    if (!active) return 'null'
    const cmContent = document.querySelector('.cm-content')
    return cmContent?.contains(active) ? 'inside-editor' : 'outside-editor'
  })
  expect(focusAfterTab).toBe('outside-editor')
})
