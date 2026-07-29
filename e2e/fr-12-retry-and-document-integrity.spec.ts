/**
 * T-FR-12-12 and T-FR-12-14: what retry does, and the promise underneath all
 * of FR-12 - that whatever happened on the network, the document is exactly
 * what it was before the request.
 *
 * Retry re-sends the same request over the same span rather than asking the
 * user to select and ask again, which is the reading the requirement leaves
 * open and the only one where retry is faster than starting over.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedValidatedKey, seedContinuationDisabled } from './seed'
import { fulfillFailure, revisionTranscript, type FailureVariant } from './openrouter-mock'
import { docText } from './pendingRevision'

const DOC = 'The setup guide is outdated.'
const PROPOSAL = 'The setup guide needs updating.'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await seedContinuationDisabled(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

async function askForRevision(page: Page, doc = DOC) {
  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('[data-testid="action-make-shorter"]').click()
}

test('T-FR-12-12: A retry that succeeds clears the message and shows the diff', async ({
  page,
}) => {
  // Given a revision failure message over the selected paragraph
  let failNext = true
  await page.route('https://openrouter.ai/**', async (route) => {
    if (failNext) return fulfillFailure(route, 'offline')
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: revisionTranscript({ reason: 'Vague', proposal: PROPOSAL }),
    })
  })

  await askForRevision(page)
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })

  // When the user clicks retry and the provider returns a valid revision
  failNext = false
  await page.locator('[data-testid="retry-button"]').click()

  // Then the message clears and the tracked-change diff appears over the
  // original span - no re-selection, no re-asking.
  await expect(page.locator('[data-testid="revision-decoration"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(PROPOSAL)
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  // Still nothing committed: a revision is proposed, not applied.
  expect(await docText(page)).toBe(DOC)
})

test('T-FR-12-12: A retry that fails again is still dismissible and still retryable', async ({
  page,
}) => {
  await page.route('https://openrouter.ai/**', (route) => fulfillFailure(route, 'offline'))

  await askForRevision(page)
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })

  // When the retry fails the same way
  await page.locator('[data-testid="retry-button"]').click()

  // Then the message is back, with both controls, and the document is untouched
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="dismiss-button"]')).toBeVisible()
  expect(await docText(page)).toBe(DOC)
})

const INTEGRITY_DOC = 'Section 2 covers the deployment process.'

/** T-FR-12-14's table: one row per failure class, all on the revision path. */
const INTEGRITY_CASES: Array<{ name: string; variant: FailureVariant }> = [
  { name: 'Network', variant: 'offline' },
  { name: 'Rate limit', variant: 'rate-limit' },
  { name: 'Credit', variant: 'credit' },
  { name: 'Malformed', variant: 'empty-body' },
]

for (const { name, variant } of INTEGRITY_CASES) {
  test(`T-FR-12-14 (${name}): the document is byte-identical once the failure resolves`, async ({
    page,
  }) => {
    await page.route('https://openrouter.ai/**', (route) => fulfillFailure(route, variant))

    await askForRevision(page, INTEGRITY_DOC)
    await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })

    // The failure resolves by dismissal
    await page.locator('[data-testid="dismiss-button"]').click()
    await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)

    // Not "roughly the same" - exactly the same string, with nothing added,
    // removed, or reordered.
    expect(await docText(page)).toBe(INTEGRITY_DOC)
  })
}

test('T-FR-12-14 (Key rejected): the document survives the round trip through the gate', async ({
  page,
}) => {
  let rejectKey = true
  await page.route('https://openrouter.ai/**', async (route) => {
    if (rejectKey) return fulfillFailure(route, 'key-rejected')
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await askForRevision(page, INTEGRITY_DOC)
  await expect(page.locator('[data-testid="key-gate-modal"]')).toBeVisible({ timeout: 10_000 })

  // The failure resolves by the gate being passed again
  rejectKey = false
  await page.locator('[data-testid="key-gate-modal"] input').fill('sk-or-v1-a-working-key')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid="key-gate-modal"]')).toHaveCount(0, { timeout: 10_000 })

  expect(await docText(page)).toBe(INTEGRITY_DOC)
})
