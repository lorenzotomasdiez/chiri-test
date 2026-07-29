import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-9-4: Filename falls back to a fixed default when there is no heading', async ({
  page,
}) => {
  // Test state (a): no text at all
  const downloadA = (
    await Promise.all([
      page.waitForEvent('download'),
      page.locator('[aria-label="Download .md"]').click(),
    ])
  )[0]

  const filenameA = downloadA.suggestedFilename()
  expect(filenameA).toMatch(/\.md$/)
  // eslint-disable-next-line no-control-regex -- intentionally asserting these are absent
  expect(filenameA).not.toMatch(/[<>:"|?*\x00-\x1f]/) // No filesystem-illegal characters

  // Clear the document for state (b)
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')

  // Test state (b): "Just a paragraph, no heading."
  await page.keyboard.type('Just a paragraph, no heading.')

  const downloadB = (
    await Promise.all([
      page.waitForEvent('download'),
      page.locator('[aria-label="Download .md"]').click(),
    ])
  )[0]

  const filenameB = downloadB.suggestedFilename()
  expect(filenameB).toMatch(/\.md$/)
  // eslint-disable-next-line no-control-regex -- intentionally asserting these are absent
  expect(filenameB).not.toMatch(/[<>:"|?*\x00-\x1f]/)

  // Clear the document for state (c)
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')

  // Test state (c): "# " (hash, space, nothing else)
  await page.keyboard.type('# ')

  const downloadC = (
    await Promise.all([
      page.waitForEvent('download'),
      page.locator('[aria-label="Download .md"]').click(),
    ])
  )[0]

  const filenameC = downloadC.suggestedFilename()
  expect(filenameC).toMatch(/\.md$/)
  // eslint-disable-next-line no-control-regex -- intentionally asserting these are absent
  expect(filenameC).not.toMatch(/[<>:"|?*\x00-\x1f]/)

  // All three filenames should be identical (the same fixed default)
  expect(filenameB).toBe(filenameA)
  expect(filenameC).toBe(filenameA)
})
