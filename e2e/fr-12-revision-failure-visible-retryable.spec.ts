/**
 * T-FR-12-2, T-FR-12-6, T-FR-12-11, T-FR-12-13: a revision failure is always
 * visible, always dismissible, always retryable, and never touches the
 * document.
 *
 * The user selected text, clicked, and is waiting - which is the whole reason
 * this class of failure is loud where continuation's is silent.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedValidatedKey, seedContinuationDisabled } from './seed'
import { mockFailure, type FailureVariant } from './openrouter-mock'
import { docText } from './pendingRevision'

const DOC = 'The onboarding flow needs a rewrite before launch.'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await seedContinuationDisabled(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/** Types the paragraph, selects all of it, and asks for a one-tap revision. */
async function askForRevision(page: Page) {
  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('[data-testid="action-make-shorter"]').click()
}

test('T-FR-12-2: An unreachable network fails visibly, dismissibly, and with a retry', async ({
  page,
}) => {
  // Given the network is unavailable
  await mockFailure(page, 'offline')

  // When the user selects the paragraph and asks for a revision
  await askForRevision(page)

  // Then a failure message appears within the 10-second ceiling
  const failure = page.locator('[data-testid="failure-message"]')
  await expect(failure).toBeVisible({ timeout: 10_000 })

  // And it carries both a dismiss and a retry control
  await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="dismiss-button"]')).toBeVisible()

  // And the document is unchanged, with no tracked-change diff shown
  expect(await docText(page)).toBe(DOC)
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
})

const RETRYABLE_VARIANTS: Array<{ name: string; variant: FailureVariant }> = [
  // T-FR-12-6: a rate-limited revision is a retryable failure, not silence.
  { name: 'T-FR-12-6: rate limit', variant: 'rate-limit' },
  // T-FR-12-11's three malformed shapes, each treated as a failed request
  // rather than as a short or best-effort answer.
  { name: 'T-FR-12-11: empty body', variant: 'empty-body' },
  { name: 'T-FR-12-11: malformed body', variant: 'malformed-body' },
  { name: 'T-FR-12-11: stream cut mid-response', variant: 'stream-cut' },
]

for (const { name, variant } of RETRYABLE_VARIANTS) {
  test(`${name} surfaces a dismissible, retryable failure and changes nothing`, async ({
    page,
  }) => {
    await mockFailure(page, variant)
    await askForRevision(page)

    await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="dismiss-button"]')).toBeVisible()

    expect(await docText(page)).toBe(DOC)
    // The stream-cut case is the one that must not leave the partial text
    // rendered as if it were a finished proposal.
    await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  })
}

test('T-FR-12-13: Dismissing without retrying leaves the editor clean and askable again', async ({
  page,
}) => {
  // Given a revision failure message is visible
  await mockFailure(page, 'offline')
  await askForRevision(page)
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })

  // When the user dismisses it without retrying
  await page.locator('[data-testid="dismiss-button"]').click()

  // Then the message is gone, with no residue left behind
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  expect(await docText(page)).toBe(DOC)

  // And the user can ask again immediately
  await page.keyboard.press('ControlOrMeta+a')
  await expect(page.locator('[data-testid="selection-action-bar"]')).toBeVisible()
  await page.locator('[data-testid="action-make-shorter"]').click()
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })
})
