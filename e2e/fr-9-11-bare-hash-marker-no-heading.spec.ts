import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-9-11: A bare "#" with nothing after it is treated as no heading', async ({
  page,
}) => {
  // Baseline: an actual empty document, to know what the fixed default looks like.
  const downloadDefault = (
    await Promise.all([
      page.waitForEvent('download'),
      page.locator('[aria-label="Download .md"]').click(),
    ])
  )[0]
  const defaultFilename = downloadDefault.suggestedFilename()
  expect(defaultFilename).toMatch(/\.md$/)

  // Document whose first (and only) line is exactly "#", with no trailing space
  // and nothing else in the document.
  await page.locator('.cm-content').click()
  await page.keyboard.type('#')

  const downloadBareHash = (
    await Promise.all([
      page.waitForEvent('download'),
      page.locator('[aria-label="Download .md"]').click(),
    ])
  )[0]
  const bareHashFilename = downloadBareHash.suggestedFilename()

  expect(bareHashFilename).toBe(defaultFilename)
  expect(bareHashFilename).not.toMatch(/^-*\.md$/) // never an empty or hyphen-only slug
})
