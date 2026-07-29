/**
 * T-FR-12-8 and T-FR-12-15: a failure the user can act on has to say which
 * failure it is, and none of them are allowed to make the editor worse to
 * write in while they are on screen.
 *
 * Credit exhaustion is the case where the wording carries the whole value:
 * "the request did not complete" sends the user to check their network, and
 * the thing to check is their OpenRouter balance.
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

async function askForRevision(page: Page) {
  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('[data-testid="action-make-shorter"]').click()
}

test('T-FR-12-8: Insufficient credit names credit as the cause and leaves the editor usable', async ({
  page,
}) => {
  // Given a revision request the provider rejects for insufficient credit
  await mockFailure(page, 'credit')

  // When the user asks for a revision
  await askForRevision(page)

  // Then the failure message names credit exhaustion as the cause
  const failure = page.locator('[data-testid="failure-message"]')
  await expect(failure).toBeVisible({ timeout: 10_000 })
  await expect(failure).toContainText(/credit/i)

  // And per CC-BANNER.6, credit exhaustion is the informational case: no
  // error-red text and no error icon, just a 2px ink left border and an
  // `info` icon - the account is fine, only the balance is not.
  await expect(failure).toHaveClass(/border-ink/)
  await expect(failure).not.toHaveClass(/text-error/)
  await expect(failure.locator('use')).toHaveAttribute('href', '/chiri-icons.svg#info')

  // And the app has not fallen back to the key gate - AC-12.5 keeps the editor
  // fully usable, because the key works and only the balance does not.
  await expect(page.locator('[data-testid="key-gate-modal"]')).toHaveCount(0)

  // And the user can continue typing immediately, with no degradation
  await page.locator('.cm-content').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Still typing.')
  expect(await docText(page)).toBe(`${DOC} Still typing.`)
})

test('T-FR-12-8: The credit message reads differently from the network and rate-limit ones', async ({
  page,
}) => {
  // The three conditions have three different things for the user to do about
  // them, so a shared line would be a shared dead end.
  const messages: string[] = []

  for (const variant of ['offline', 'rate-limit', 'credit'] as const) {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await mockFailure(page, variant)
    await page.reload()
    await page.waitForSelector('[data-testid="editor"] .cm-content')

    await askForRevision(page)
    const failure = page.locator('[data-testid="failure-message"]')
    await expect(failure).toBeVisible({ timeout: 10_000 })
    messages.push((await failure.textContent()) ?? '')
    await page.locator('[data-testid="dismiss-button"]').click()
  }

  expect(new Set(messages).size).toBe(3)
})

test('T-FR-12-15: Editing continues uninterrupted while a failure message is on screen', async ({
  page,
}) => {
  // Given a revision failure message is visible
  await mockFailure(page, 'offline')
  await askForRevision(page)
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible({ timeout: 10_000 })

  // When the user clicks into the document and types
  await page.locator('.cm-content').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Adding a note here while the error is showing.')

  // Then the typed text appears at the caret
  expect(await docText(page)).toBe(`${DOC} Adding a note here while the error is showing.`)

  // And the failure message is still there, untouched, until the user acts on it
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible()
})
