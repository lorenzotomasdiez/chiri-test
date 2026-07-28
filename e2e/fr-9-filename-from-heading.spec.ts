import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.describe('T-FR-9-3: Downloaded filename derived from first-line heading', () => {
  test.beforeEach(async ({ page }) => {
    await seedValidatedKey(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForSelector('[data-testid="editor"] .cm-content')
    await page.evaluate(() => document.fonts.ready)
  })

  const headingCases = [
    { heading: '# Getting Started', expectedWords: ['getting', 'started'] },
    { heading: '## Release Notes', expectedWords: ['release', 'notes'] },
    { heading: '# What\'s New?', expectedWords: ['what', 'new'] },
    { heading: '#   Draft   Plan', expectedWords: ['draft', 'plan'] }
  ]

  for (const testCase of headingCases) {
    test(`T-FR-9-3: heading "${testCase.heading}" produces filename with ${testCase.expectedWords.join(', ')}`, async ({ page }) => {
      // Clear the editor and set the heading
      const editor = page.locator('[data-testid="editor"] .cm-content')
      await editor.click()
      await page.keyboard.press('Control+A')
      await page.keyboard.press('Delete')
      await page.keyboard.type(testCase.heading)

      // Trigger download and capture the download event
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-testid="download-button"]').click()
      ])

      const filename = download.suggestedFilename()

      // Verify filename ends with .md
      expect(filename).toMatch(/\.md$/)

      // Verify non-empty before extension
      const nameWithoutExt = filename.replace(/\.md$/, '')
      expect(nameWithoutExt.length).toBeGreaterThan(0)

      // Verify no invalid filename characters: / \ : * ? " < > |
      expect(filename).not.toMatch(/[/\\:*?"<>|]/)

      // Verify contains expected words (case-insensitive, ignoring separators)
      const lowerFilename = filename.toLowerCase()
      for (const word of testCase.expectedWords) {
        expect(lowerFilename).toContain(word)
      }

      // Verify it is recognisably derived from heading (not a generic default)
      // by confirming it contains heading content words, not just generic terms
      const hasHeadingContent = testCase.expectedWords.every(word => lowerFilename.includes(word))
      expect(hasHeadingContent).toBe(true)

      await download.delete()
    })
  }
})
