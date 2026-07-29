import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-9-1: Copy places the document\'s Markdown on the clipboard and confirms it', async ({
  page,
}) => {
  // Type the committed document into the editor
  const documentText = '# Notes\n\nFirst paragraph.\n\nSecond paragraph.\n\n- alpha\n- beta'
  await page.locator('.cm-content').click()
  await page.keyboard.type(documentText)

  // Verify the document is in the editor
  const editorContent = await page.evaluate(
    () => (window as unknown as { __editor: { state: { doc: { toString(): string } } } }).__editor.state.doc.toString(),
  )
  expect(editorContent).toBe(documentText)

  // Click the Copy button in the top bar
  const copyButton = page.locator('[data-testid="copy-button"]')
  await copyButton.click()

  // Read from the clipboard
  const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())

  // Assert clipboard contains exactly the document markdown
  expect(clipboardContent).toBe(editorContent)

  // Assert the button's own label stays "Copy" (CC-TOAST.1: confirmation is a
  // separate label beside the control, not a substitution of it) while a
  // separate confirmation toast appears beside it
  await expect(copyButton).toHaveText('Copy')
  await expect(page.locator('[data-testid="copy-confirmation"]')).toHaveText('Copied')
})
