import { test, expect, type Page } from '@playwright/test'
import { seedValidatedKey } from './seed'

/**
 * T-FR-8-9: the selector is reachable and operable by keyboard alone (NFR-6).
 *
 * No pointer is used anywhere in this spec - no click(), no hover. If any
 * assertion here needs a mouse to pass, the control is not keyboard-operable,
 * which is the whole point of the scenario.
 */

const TRIGGER = '[data-testid="model-selector-trigger"]'
const PANEL = '[data-testid="model-selector-panel"]'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/** The testid of whatever currently holds focus, or null. */
function focusedTestId(page: Page) {
  return page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null)
}

/** Tabs forward until the trigger takes focus. Returns how many presses it took. */
async function tabToTrigger(page: Page, maxPresses = 12): Promise<number> {
  for (let presses = 1; presses <= maxPresses; presses++) {
    await page.keyboard.press('Tab')
    if ((await focusedTestId(page)) === 'model-selector-trigger') return presses
  }
  throw new Error(`model-selector-trigger never took focus within ${maxPresses} Tab presses`)
}

test('T-FR-8-9: the selector can be reached, opened, moved through and committed by keyboard alone', async ({
  page,
}) => {
  const trigger = page.locator(TRIGGER)
  await expect(trigger).toHaveText(/^GPT-4o mini$/)

  // Reachable by Tab from a fresh load, without a pointer.
  await tabToTrigger(page)

  // Enter opens the panel.
  await page.keyboard.press('Enter')
  const panel = page.locator(PANEL)
  await expect(panel).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')

  // Arrow down to the second option and confirm it.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  // The panel closes and the new selection is shown, with no pointer used.
  await expect(panel).toHaveCount(0)
  await expect(trigger).toHaveText(/^GPT-4o$/)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  // Focus lands back on the trigger rather than being lost to the page body.
  expect(await focusedTestId(page)).toBe('model-selector-trigger')
})

test('T-FR-8-9: Escape closes the panel without changing the selection and returns focus', async ({
  page,
}) => {
  const trigger = page.locator(TRIGGER)

  await tabToTrigger(page)
  await page.keyboard.press('Enter')
  await expect(page.locator(PANEL)).toBeVisible()

  // Move the highlight, then abandon the choice.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')

  await expect(page.locator(PANEL)).toHaveCount(0)
  await expect(trigger).toHaveText(/^GPT-4o mini$/)
  expect(await focusedTestId(page)).toBe('model-selector-trigger')
})

test('T-FR-8-9: arrow keys stop at the ends of the list rather than wrapping past them', async ({
  page,
}) => {
  const trigger = page.locator(TRIGGER)

  await tabToTrigger(page)
  await page.keyboard.press('Enter')
  await expect(page.locator(PANEL)).toBeVisible()

  const rowCount = await page.locator('[data-testid="model-row"]').count()

  // Push well past the end of the list, then commit. The last option should be
  // selected - not the first, which is what a wrap would land on, and not
  // nothing, which is what an out-of-range index would commit.
  for (let i = 0; i < rowCount + 3; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  await expect(trigger).toHaveText(/^GPT-4.1$/)
})
