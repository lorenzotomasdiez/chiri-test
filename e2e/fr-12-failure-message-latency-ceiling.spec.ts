/**
 * T-FR-12-3: AC-12.2's 10-second ceiling on how long a user who asked for a
 * revision waits before being told it did not happen.
 *
 * The failure this pins down is not a refused connection - those report back
 * immediately - but an accepted one that never answers, where the browser's
 * own timeout is measured in minutes. The plan's third row, a message arriving
 * after the ceiling, is stated as the thing that must not happen rather than
 * as a case to run: it has no passing form.
 */

import { test, expect } from '@playwright/test'
import { seedValidatedKey, seedContinuationDisabled } from './seed'
import { docText } from './pendingRevision'

const DOC = 'The onboarding flow needs a rewrite before launch.'
const CEILING_MS = 10_000

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await seedContinuationDisabled(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-12-3: A request that never answers still fails visibly inside 10 seconds', async ({
  page,
}) => {
  // Given a connection the network accepts and then leaves hanging
  await page.route('https://openrouter.ai/**', async () => {
    // Never fulfilled, never aborted - the route handler simply returns.
  })

  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')

  const started = Date.now()
  await page.locator('[data-testid="action-make-shorter"]').click()

  // Then the failure message is on screen by the ceiling, with its retry
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({
    timeout: CEILING_MS,
  })
  const elapsed = Date.now() - started
  expect(elapsed).toBeLessThanOrEqual(CEILING_MS)

  await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  expect(await docText(page)).toBe(DOC)
})
