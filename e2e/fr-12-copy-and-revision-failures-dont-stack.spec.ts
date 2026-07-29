/**
 * FR-12's "one banner, not one per caller" invariant (src/state/store.ts),
 * exercised across its two independent sources at once: TopBar's clipboard
 * write and Editor's revision request. Before this fix each mounted its own
 * FailureBanner at the same fixed position, so triggering both together
 * would stack two overlapping banners instead of showing exactly one.
 */

import { test, expect } from '@playwright/test'
import { seedValidatedKey, seedContinuationDisabled } from './seed'
import { mockFailure } from './openrouter-mock'
import { docText } from './pendingRevision'

const DOC = 'The onboarding flow needs a rewrite before launch.'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await seedContinuationDisabled(page)

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => Promise.reject(new Error('denied')),
      },
      configurable: true,
    })
  })

  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-12-18: a clipboard failure and a revision failure never render as two banners', async ({
  page,
}) => {
  // Given a clipboard write has already failed and its banner is showing
  await page.getByRole('button', { name: 'Copy' }).click()
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="failure-message"]')).toContainText(
    "Couldn't copy to the clipboard.",
  )

  // When a revision request also fails while that banner is still up
  await mockFailure(page, 'offline')
  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('[data-testid="action-make-shorter"]').click()

  // Then exactly one banner is ever on screen - the request failure, since it
  // takes priority - never a stack of both
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator('[data-testid="failure-message"]')).not.toContainText(
    "Couldn't copy to the clipboard.",
  )

  // And dismissing it never reveals two banners at once - the still-pending
  // copy failure takes its place, one at a time, until it is dismissed too
  await page.locator('[data-testid="dismiss-button"]').click()
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="failure-message"]')).toContainText(
    "Couldn't copy to the clipboard.",
  )
  await page.locator('[data-testid="dismiss-button"]').click()
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  expect(await docText(page)).toBe(DOC)
})
