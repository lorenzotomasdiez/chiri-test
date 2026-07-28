import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import fs from 'fs'
import path from 'path'
import os from 'os'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)

  // Override navigator.clipboard.writeText to reject with an error
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => Promise.reject(new Error('denied')),
      },
      configurable: true,
    })
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-9-7: Clipboard failure is surfaced with a retry and download still works', async ({
  page,
}) => {
  // Given the editor holds "# Fallback\n\nBody text."
  await page.locator('.cm-content').click()
  await page.keyboard.type('# Fallback')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Body text.')

  // Verify document text is correct
  const docBefore = await page.evaluate(
    () => (window as unknown as { __editor: { state: { doc: { toString(): string } } } }).__editor.state.doc.toString(),
  )
  expect(docBefore).toBe('# Fallback\n\nBody text.')

  // When the user clicks Copy
  const copyButton = page.getByRole('button', { name: 'Copy' })
  await copyButton.click()

  // Then a dismissible failure message appears offering a retry (FR-12 treatment)
  const failureMessage = page.locator('[data-testid="failure-message"], [data-testid="error-message"], [role="alert"]').first()
  await expect(failureMessage).toBeVisible()

  // Verify retry button exists in the failure message
  const retryButton = failureMessage.locator('[data-testid="retry-button"], button').filter({ hasText: /retry|try again/i }).first()
  await expect(retryButton).toBeVisible()

  // Verify the document is still exactly "# Fallback\n\nBody text."
  const docAfterError = await page.evaluate(
    () => (window as unknown as { __editor: { state: { doc: { toString(): string } } } }).__editor.state.doc.toString(),
  )
  expect(docAfterError).toBe('# Fallback\n\nBody text.')

  // Dismiss the failure message by clicking a dismiss button
  const dismissButton = failureMessage.locator('[data-testid="dismiss-button"], button').filter({ hasText: /close|dismiss|×/i }).first()
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click()
  } else {
    // Click elsewhere to dismiss
    await page.keyboard.press('Escape')
  }

  // When clicking Download .md afterwards
  const downloadPromise = page.waitForEvent('download')
  const downloadButton = page.getByRole('button', { name: 'Download .md' })
  await downloadButton.click()

  const download = await downloadPromise

  // Then it still yields a .md download whose contents equal the document text
  const filename = await download.suggestedFilename()
  expect(filename).toMatch(/\.md$/)

  // Save download to a temporary location and read its contents
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chiri-download-'))
  const downloadPath = path.join(tempDir, filename)
  await download.saveAs(downloadPath)

  const downloadedContent = fs.readFileSync(downloadPath, 'utf-8')
  expect(downloadedContent).toBe('# Fallback\n\nBody text.')

  // Cleanup
  fs.unlinkSync(downloadPath)
  fs.rmdirSync(tempDir)
})
