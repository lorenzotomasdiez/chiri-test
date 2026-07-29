import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { mockClipboard } from './clipboard'
import * as fs from 'fs'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await mockClipboard(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-9-8: Export works on a completely empty document', async ({ page }) => {
  // Verify the document is empty
  const docContent = await page.evaluate(() => window.__editor.state.doc.toString())
  expect(docContent).toBe('')

  // Test Copy button
  const copyButton = page.getByRole('button', { name: 'Copy' })
  await copyButton.click()

  // Verify the Copy confirmation is shown
  await expect(copyButton).toHaveText('Copied')

  // Verify clipboard contents are empty
  const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardContent).toBe('')

  // Test Download .md button
  const downloadButton = page.getByRole('button', { name: 'Download .md' })

  // Set up download listener before clicking
  const downloadPromise = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloadPromise

  // Verify the filename ends with .md
  const filename = download.suggestedFilename()
  expect(filename).toMatch(/\.md$/)

  // Verify the file contents are either empty or just a newline
  const path = await download.path()
  const contents = fs.readFileSync(path, 'utf-8')
  expect(contents === '' || contents === '\n').toBe(true)
})
