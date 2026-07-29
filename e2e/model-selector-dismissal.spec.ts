import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-CC-MODEL-12: Dropdown dismisses on Escape and outside click, returns focus to the trigger, and moves by arrow keys (CC-MODEL.12, CC-PANEL.5, CC-MODEL.13)', async ({
  page,
}) => {
  // Located by role, not by its label: the whole point of this test is that the
  // trigger's text changes, so a text-based locator would stop matching the
  // moment the behaviour under test works.
  const trigger = page.locator('button[aria-haspopup="listbox"]')
  await trigger.click()

  // Panel should be visible
  const panel = page.locator('div[role="listbox"]')
  await expect(panel).toBeVisible()

  // Test Escape key dismisses and returns focus to trigger
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeInViewport()
  expect(await page.evaluate(() => document.activeElement?.textContent)).toContain('GPT-4o mini')

  // Open the panel again
  await trigger.click()
  await expect(panel).toBeVisible()

  // Test outside click dismisses without selecting. The offset only has to be
  // somewhere inside the document column and nowhere near the panel - the
  // column is sized to the viewport (CC-SHELL.5), so a y past the fold would
  // simply not be part of the element to click.
  await page.click('[data-testid="editor"]', { position: { x: 200, y: 300 } })
  await expect(panel).not.toBeInViewport()
  expect(await trigger.textContent()).toContain('GPT-4o mini')

  // Open the panel a third time with keyboard
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(panel).toBeVisible()

  // Press ArrowDown twice to highlight the third option (GPT-4.1)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')

  // Verify the third row is highlighted (keyboard focus), not yet committed as
  // the actual selection - aria-selected must track the real selection, not
  // arrow-key highlight, so it stays false until Enter commits the choice.
  const options = page.locator('div[role="option"]')
  const thirdOption = options.nth(2)
  await expect(thirdOption).toHaveAttribute('aria-selected', 'false')
  const thirdOptionBgColor = await thirdOption.evaluate(
    (el) => window.getComputedStyle(el).backgroundColor,
  )
  expect(thirdOptionBgColor).toBe('rgb(241, 237, 236)') // container fill = highlight signal

  // Press Enter to select
  await page.keyboard.press('Enter')

  // Panel should be closed
  await expect(panel).not.toBeInViewport()

  // Focus should return to trigger
  expect(await page.evaluate(() => document.activeElement?.textContent)).toContain('GPT-4.1')

  // Trigger text should be updated to GPT-4.1
  expect(await trigger.textContent()).toContain('GPT-4.1')
})
