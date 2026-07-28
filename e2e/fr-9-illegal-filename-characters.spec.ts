import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  // Settle the webfonts before anything is clicked to avoid layout shifts
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-9-9: Filesystem-illegal heading characters still yield a usable filename', async ({
  page,
}) => {
  // Set the document to have a heading with filesystem-illegal characters
  const headingText = '# Q1/Q2 Report: "Final" <v2>'
  const editorContent = page.locator('[data-testid="editor"] .cm-content')

  // Type the heading into the editor
  await editorContent.click()
  await editorContent.type(headingText)

  // Wait for the editor to settle
  await page.waitForTimeout(100)

  // Click the Download .md button and capture the download
  const downloadPromise = page.waitForEvent('download')
  const downloadButton = page.locator('button:has-text("Download .md")')
  await downloadButton.click()

  const download = await downloadPromise
  const suggestedFilename = download.suggestedFilename()

  // Assert the download completes (file path exists)
  expect(suggestedFilename).toBeTruthy()

  // Assert filename ends with .md
  expect(suggestedFilename).toMatch(/\.md$/)

  // Assert filename contains none of the filesystem-illegal characters
  const illegalCharacters = /[\/\\:*?"<>|]/
  expect(suggestedFilename).not.toMatch(illegalCharacters)

  // Assert no control characters (ASCII 0-31 and 127)
  const controlCharacters = /[\x00-\x1f\x7f]/
  expect(suggestedFilename).not.toMatch(controlCharacters)

  // Assert filename does not start or end with a dot or space before the extension
  // Split to check the part before .md
  const withoutExtension = suggestedFilename.replace(/\.md$/, '')
  expect(withoutExtension).not.toMatch(/^\s/)
  expect(withoutExtension).not.toMatch(/\s$/)
  expect(withoutExtension).not.toMatch(/^\./)
  expect(withoutExtension).not.toMatch(/\.$/)

  // Assert filename contains readable words from the heading (case-insensitive)
  const lowercaseFilename = suggestedFilename.toLowerCase()
  expect(lowercaseFilename).toContain('q1')
  expect(lowercaseFilename).toContain('q2')
  expect(lowercaseFilename).toContain('report')
  expect(lowercaseFilename).toContain('final')
})
