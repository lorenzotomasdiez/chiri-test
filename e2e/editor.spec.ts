import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('mounts an editable CodeMirror surface and accepts typing', async ({ page }) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type('# Chiri\n\nThe first paragraph.')

  expect(await docText(page)).toBe('# Chiri\n\nThe first paragraph.')
})

test('shows the onboarding cue only while the document is empty (AC-11.2, AC-11.3)', async ({
  page,
}) => {
  await expect(page.getByTestId('onboarding-cue')).toBeVisible()

  await page.locator('.cm-content').click()
  await page.keyboard.type('a')
  await expect(page.getByTestId('onboarding-cue')).toBeHidden()

  // AC-11.4: emptying the document brings it back, with no content lost.
  await page.keyboard.press('Backspace')
  await expect(page.getByTestId('onboarding-cue')).toBeVisible()
  expect(await docText(page)).toBe('')
})

test('undo reverts a typed run and redo reapplies it (AC-3.3, AC-3.4)', async ({ page }) => {
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.locator('.cm-content').click()
  await page.keyboard.type('hello')

  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe('')

  await page.keyboard.press(`${mod}+Shift+z`)
  expect(await docText(page)).toBe('hello')
})

test('renders the writing surface', async ({ page }, testInfo) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type('# Chiri\n\nMarkdown, with an AI that stays behind the caret.')
  await expect(page.getByTestId('onboarding-cue')).toBeHidden()

  await testInfo.attach('editor', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
})
