import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  // Settle the webfonts before anything is clicked. The dropdown rows are
  // text-sized, so a font landing after Playwright has measured a row but
  // before it clicks reflows the panel under the recorded point - the click
  // then lands past the panel's bottom edge, where the outside-click handler
  // closes it without ever committing a selection. That produced a rare
  // failure here with `model` absent from storage rather than merely wrong,
  // which is the signature of no commit at all.
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-8-6: The selected model persists across a reload', async ({ page }) => {
  // Verify initial state: trigger shows GPT-4o mini
  const trigger = page.locator('[data-testid="model-selector-trigger"]')
  await expect(trigger).toHaveText(/^GPT-4o mini$/)

  // Open the model selector panel
  await trigger.click()

  // Get the panel and its rows
  const panel = page.locator('[data-testid="model-selector-panel"]')
  await expect(panel).toBeVisible()

  const rows = panel.locator('[data-testid="model-row"]')
  const row2 = rows.nth(1) // GPT-4o is the second entry

  // Verify row 2 is GPT-4o
  const row2Title = row2.locator('[data-testid="model-row-title"]')
  await expect(row2Title).toHaveText('GPT-4o')

  // Click the GPT-4o row
  await row2.click()

  // Verify panel is now closed
  await expect(panel).toHaveCount(0)

  // Verify localStorage contains the new model selection
  const storageContent = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('chiri-settings') || '{}')
  })
  expect(storageContent.model).toBe('openai/gpt-4o')

  // Reload the page. Nothing re-writes `model` here: what survives the reload
  // is what the app itself persisted when the row was clicked, which is the
  // whole of what this scenario claims (AC-8.4).
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // After reload, verify trigger shows GPT-4o (not GPT-4o mini)
  const triggerAfterReload = page.locator('[data-testid="model-selector-trigger"]')
  await expect(triggerAfterReload).toHaveText(/^GPT-4o$/)

  // Open the panel again to verify the check icon is on the correct row
  await triggerAfterReload.click()

  const panelAfterReload = page.locator('[data-testid="model-selector-panel"]')
  await expect(panelAfterReload).toBeVisible()

  const rowsAfterReload = panelAfterReload.locator('[data-testid="model-row"]')
  const row1AfterReload = rowsAfterReload.nth(0) // GPT-4o mini
  const row2AfterReload = rowsAfterReload.nth(1) // GPT-4o

  // Verify check icon is on row 2 (GPT-4o), not on row 1
  const checkIconRow1 = row1AfterReload.locator('[data-testid="check-icon"]')
  const checkIconRow2 = row2AfterReload.locator('[data-testid="check-icon"]')

  await expect(checkIconRow2).toBeVisible()
  await expect(checkIconRow1).toHaveCount(0)

  // Verify row 2 is marked as selected
  await expect(row2AfterReload).toHaveAttribute('aria-selected', 'true')
  await expect(row1AfterReload).toHaveAttribute('aria-selected', 'false')

  // Verify localStorage still contains the correct model after reload
  const storageContentAfterReload = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('chiri-settings') || '{}')
  })
  expect(storageContentAfterReload.model).toBe('openai/gpt-4o')
})
