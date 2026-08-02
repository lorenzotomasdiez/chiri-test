/**
 * CC-PANEL.5: every floating panel dismisses on Escape and on outside click.
 * FailureBanner is one of the three panels core-components.md section 8
 * names as covered by this rule (alongside the model dropdown and the
 * selection action bar), but it previously only closed via its own Dismiss
 * button.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedValidatedKey, seedContinuationDisabled } from './seed'
import { mockFailure } from './openrouter-mock'
import { docText } from './pendingRevision'

const DOC = 'The onboarding flow needs a rewrite before launch.'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await seedContinuationDisabled(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

async function triggerFailureBanner(page: Page) {
  await mockFailure(page, 'offline')
  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('[data-testid="action-make-shorter"]').click()
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })
}

test('CC-PANEL.5: Escape dismisses the failure banner', async ({ page }) => {
  await triggerFailureBanner(page)

  await page.keyboard.press('Escape')

  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  expect(await docText(page)).toBe(DOC)
})

test('CC-PANEL.5: clicking outside the failure banner dismisses it', async ({ page }) => {
  await triggerFailureBanner(page)

  // Click somewhere clearly outside the banner (fixed top-14 right-6) and
  // outside the editor, so it isn't mistaken for a new document click.
  await page.locator('header').click({ position: { x: 10, y: 10 } })

  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  expect(await docText(page)).toBe(DOC)
})
