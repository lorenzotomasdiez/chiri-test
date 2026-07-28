import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-8-1: Default model preselected on a first-ever session', async ({
  page,
}) => {
  // Assert the model trigger shows GPT-4o mini without user clicking it
  const trigger = page.locator('[data-testid="model-selector-trigger"]')
  await expect(trigger).toHaveText(/^GPT-4o mini$/)

  // Assert the panel was never opened (count 0 throughout)
  const panel = page.locator('[data-testid="model-selector-panel"]')
  await expect(panel).toHaveCount(0)

  // Assert the editor accepts typing immediately - type a character to verify
  const editorContent = page.locator('[data-testid="editor"] .cm-content')
  await editorContent.click()
  await page.keyboard.type('test')

  // Verify the text was inserted into the editor
  const editorText = await editorContent.textContent()
  expect(editorText).toContain('test')
})
