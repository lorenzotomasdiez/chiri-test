/**
 * T-FR-12-7 and T-FR-12-17: a rejected key is the one failure that overrides
 * both classes' rules.
 *
 * A continuation failure shows nothing - except this one, which puts the gate
 * back up. A revision failure shows a retryable banner - except this one,
 * which puts the gate back up instead, because retrying a request with a key
 * OpenRouter has just refused can only fail the same way.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedValidatedKey, seedContinuationDisabled } from './seed'
import { fulfillFailure, mockFailure, revisionTranscript } from './openrouter-mock'
import { docText, seedPendingRevision } from './pendingRevision'

const DOC = 'Chapter One: The Beginning'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

async function expectGateWithDocumentIntact(page: Page) {
  // The gate is up and the editor is no longer reachable...
  await expect(page.locator('[data-testid="key-gate-modal"]')).toBeVisible({ timeout: 10_000 })
  // ...but the document was never the network's to damage: it is still there,
  // behind the gate, exactly as it was.
  expect(await docText(page)).toBe(DOC)
}

test('T-FR-12-7 (revision): A rejected key raises the key gate, not a revision failure', async ({
  page,
}) => {
  await seedContinuationDisabled(page)
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  await mockFailure(page, 'key-rejected')

  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('[data-testid="action-make-shorter"]').click()

  await expectGateWithDocumentIntact(page)
  // Not a revision failure message: the request did not fail, the session did.
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
})

test('T-FR-12-7 (refinement): A rejected key mid-chain raises the key gate', async ({ page }) => {
  await seedContinuationDisabled(page)
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  await seedPendingRevision(page, {
    doc: DOC,
    span: 'The Beginning',
    proposed: 'The Start',
    reason: 'shorter',
    instructionHistory: ['make it shorter'],
  })

  await mockFailure(page, 'key-rejected')

  await page.locator('[data-testid="refinement-instruction-input"]').fill('less formal')
  await page.locator('[data-testid="revision-refine-submit"]').click()

  await expectGateWithDocumentIntact(page)
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
})

test('T-FR-12-7 (continuation): A rejected key raises the key gate with nothing else shown', async ({
  page,
}) => {
  // Continuation is left on here on purpose - this is the one case where the
  // silent class still has to reach the gate.
  await mockFailure(page, 'key-rejected')

  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  // Long enough for the settle window to elapse and the request to be issued.
  await expect(page.locator('[data-testid="key-gate-modal"]')).toBeVisible({ timeout: 10_000 })

  expect(await docText(page)).toBe(DOC)
  // No continuation failure message at all: the failure itself stayed silent,
  // and only the gate speaks.
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="ghost-text"]')).toHaveCount(0)
})

test('T-FR-12-7: Entering a new valid key returns the user to the same document', async ({
  page,
}) => {
  await seedContinuationDisabled(page)
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // The stored key is rejected by a revision request, so the gate goes up.
  let rejectKey = true
  await page.route('https://openrouter.ai/**', async (route) => {
    if (rejectKey) return fulfillFailure(route, 'key-rejected')
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: revisionTranscript({ reason: 'ok', proposal: 'ok' }),
    })
  })

  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('[data-testid="action-make-shorter"]').click()
  await expect(page.locator('[data-testid="key-gate-modal"]')).toBeVisible({ timeout: 10_000 })

  // When a working key is entered, the gate is passed again
  rejectKey = false
  await page.locator('[data-testid="key-gate-modal"] input').fill('sk-or-v1-a-working-key')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid="key-gate-modal"]')).toHaveCount(0, { timeout: 10_000 })

  // And the document is exactly what it was before the rejection
  expect(await docText(page)).toBe(DOC)
})

test('T-FR-12-17: A key rejection replaces an already-visible revision failure', async ({
  page,
}) => {
  await seedContinuationDisabled(page)
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // Given an earlier network failure whose message is still undismissed
  let variant: 'offline' | 'key-rejected' = 'offline'
  await page.route('https://openrouter.ai/**', (route) => fulfillFailure(route, variant))

  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('[data-testid="action-make-shorter"]').click()
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })

  // When the next request has the stored key rejected
  variant = 'key-rejected'
  await page.locator('[data-testid="retry-button"]').click()

  // Then the gate is presented, and the older message is not left showing
  // beside it - one problem, stated once.
  await expect(page.locator('[data-testid="key-gate-modal"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
})
