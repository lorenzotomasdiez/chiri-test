import { test, expect } from '@playwright/test'
import fs from 'fs'
import { seedValidatedKey } from './seed'
import { mockClipboard } from './clipboard'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await mockClipboard(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-9-15: Non-ASCII content survives both export paths intact', async ({ page }) => {
  const testContent = '# Café Résumé 🎉 مرحبا\n\nnaïve — ok'

  // Set editor content by focusing and typing
  const editor = page.locator('[data-testid="editor"]')
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type(testContent)

  // Wait a moment for content to settle
  await page.waitForTimeout(100)

  // Verify the content was set in the editor state
  const editorState = await page.evaluate(() => {
    return (window as any).__editor.state.doc.toString()
  })
  expect(editorState).toBe(testContent)

  // Test clipboard export
  const copyButton = page.locator('[data-testid="copy-button"]')
  await copyButton.click()

  // Wait for clipboard operation to complete
  await page.waitForTimeout(100)

  const clipboardContent = await page.evaluate(async () => {
    return await navigator.clipboard.readText()
  })

  // Test download export
  const downloadPromise = page.waitForEvent('download')
  const downloadButton = page.locator('[data-testid="download-button"]')
  await downloadButton.click()
  const download = await downloadPromise

  // Get the downloaded file content
  const downloadPath = await download.path()
  const downloadedContent = fs.readFileSync(downloadPath, 'utf-8')

  // Verify clipboard string equals editor state
  expect(clipboardContent).toBe(editorState)

  // Verify downloaded file content equals editor state
  expect(downloadedContent).toBe(editorState)

  // Verify neither contains replacement character
  expect(clipboardContent).not.toContain('�')
  expect(downloadedContent).not.toContain('�')

  // Verify byte-for-byte equality between clipboard and download
  const clipboardBytes = Buffer.from(clipboardContent, 'utf-8')
  const downloadedBytes = Buffer.from(downloadedContent, 'utf-8')
  expect(clipboardBytes).toEqual(downloadedBytes)

  // Verify filename ends in .md and is not empty before the extension
  const filename = download.suggestedFilename()
  expect(filename).toMatch(/\.md$/)
  expect(filename.slice(0, -3)).not.toBe('')
})
