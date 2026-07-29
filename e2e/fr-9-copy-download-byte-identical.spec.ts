import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { seedValidatedKey } from './seed'

const TEST_MARKDOWN = `# Report

**bold** and *italic* and \`code\`.

1. one
2. two

\`\`\`
const x = 1
\`\`\`

> quoted`

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-9-2: Download and clipboard produce byte-identical Markdown', async ({
  page,
  context,
}) => {
  // Set the editor content to the test markdown
  await page.locator('[data-testid="editor"]').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type(TEST_MARKDOWN)

  // Wait for any debouncing or state updates
  await page.waitForTimeout(100)

  // Click Copy button
  const copyButton = page.locator('[data-testid="copy-button"]')
  await copyButton.click()

  // Read the clipboard content
  const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())

  // Set up download listener and click Download button
  const downloadPromise = context.waitForEvent('download')
  const downloadButton = page.locator('[data-testid="download-button"]')
  await downloadButton.click()

  const download = await downloadPromise

  // Save the download to a temporary location and read it
  const downloadPath = path.join('/tmp', `download-${Date.now()}.md`)
  await download.saveAs(downloadPath)

  const downloadedContent = fs.readFileSync(downloadPath, 'utf8')

  // Clean up
  fs.unlinkSync(downloadPath)

  // Assert byte-for-byte equality
  expect(downloadedContent).toBe(clipboardContent)

  // Assert neither has a BOM (UTF-8 BOM is EF BB BF in bytes)
  const clipboardBytes = Buffer.from(clipboardContent, 'utf8')
  const downloadedBytes = Buffer.from(downloadedContent, 'utf8')

  expect(clipboardBytes.slice(0, 3).toString('hex')).not.toBe('efbbbf')
  expect(downloadedBytes.slice(0, 3).toString('hex')).not.toBe('efbbbf')
})
