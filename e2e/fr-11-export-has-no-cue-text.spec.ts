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
})

test('T-FR-11-2: Exported Markdown from a first-ever session contains no sample or placeholder text', async ({
  page,
}) => {
  // Verify the onboarding cue is visible (we are in a first-ever empty session)
  const onboardingCue = page.locator('[data-testid="onboarding-cue"]')
  await expect(onboardingCue).toBeVisible()

  // Verify the document is completely empty
  const docContent = await page.evaluate(
    () => (window as unknown as { __editor: { state: { doc: { toString(): string } } } }).__editor.state.doc.toString(),
  )
  expect(docContent).toBe('')

  // Test Copy button with empty document
  const copyButton = page.getByRole('button', { name: 'Copy' })
  await copyButton.click()

  // Verify the Copy button shows confirmation beside itself, keeping its own label
  await expect(copyButton).toHaveText('Copy')
  await expect(page.locator('[data-testid="copy-confirmation"]')).toHaveText('Copied')

  // Read from the clipboard and verify it is empty
  const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardContent).toBe('')

  // Verify clipboard does not contain the cue's text
  expect(clipboardContent).not.toContain('Start writing')
  expect(clipboardContent).not.toContain('Tab')

  // Test Download .md button
  const downloadButton = page.getByRole('button', { name: 'Download .md' })

  // Set up download listener before clicking
  const downloadPromise = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloadPromise

  // Verify the filename ends with .md
  const filename = download.suggestedFilename()
  expect(filename).toMatch(/\.md$/)

  // Read the downloaded file and verify contents are empty or just a newline
  const path = await download.path()
  const contents = fs.readFileSync(path, 'utf-8')
  expect(contents === '' || contents === '\n').toBe(true)

  // Verify the file contents do not contain the cue's text
  expect(contents).not.toContain('Start writing')
  expect(contents).not.toContain('Tab')
})
