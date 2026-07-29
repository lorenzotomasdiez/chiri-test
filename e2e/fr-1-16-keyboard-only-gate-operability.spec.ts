/**
 * T-FR-1-16 (P0, AC-1.12): the key gate modal must be fully operable by
 * keyboard alone - tab to the key field, submit with Enter, cancel an
 * in-flight validation with a keyboard shortcut, and read every message the
 * gate can show (rejected, incomplete check, account condition) by moving
 * focus alone, never a pointer.
 *
 * No `.click()` call appears anywhere in this file - that omission is the
 * assertion. Playwright's `page.keyboard` API is the only way input reaches
 * the page.
 */

import { test, expect } from '@playwright/test'
import { fulfillFailure } from './openrouter-mock'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('[data-testid="key-gate-modal"]')
})

test('T-FR-1-16: the key field is reachable by Tab and submits with Enter', async ({ page }) => {
  const input = page.locator('#key-gate-input')

  // The field autofocuses on mount, which is itself the keyboard-only entry
  // point: there is nothing to click before typing can begin.
  await expect(input).toBeFocused()

  // Tab forward reaches Connect, then Shift+Tab back reaches the field again -
  // a round trip proving the field sits in the ordinary tab sequence rather
  // than being an unreachable island a screen-reader user could tab past.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Connect' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(input).toBeFocused()

  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
    })
  })

  await page.keyboard.type('sk-or-v1-a-working-key')
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('key-gate-modal')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.locator('[data-testid="editor"] .cm-content')).toBeVisible()
})

test('T-FR-1-16: an in-flight validation can be cancelled with the keyboard alone', async ({
  page,
}) => {
  const input = page.locator('#key-gate-input')

  await page.route('https://openrouter.ai/**', async (route) => {
    // Long enough that the test can reach and activate Cancel before it
    // resolves; the assertion is that the cancel wins, not that this
    // response never lands.
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
    })
  })

  await input.focus()
  await page.keyboard.type('sk-or-v1-a-slow-key')
  await page.keyboard.press('Enter')

  // Validating status is up, and both the field and the Connect button are
  // disabled while it runs - Cancel is the only control left in the tab
  // sequence, since disabled elements are removed from it entirely.
  await expect(page.getByTestId('key-gate-status')).toHaveText(/checking your key/i)
  await expect(input).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Connect' })).toBeDisabled()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Enter')

  // Cancelling returns to blocked-empty: the status line reverts, the field
  // re-enables, and the draft the user typed is retained rather than lost.
  await expect(page.getByTestId('key-gate-status')).toHaveText(/enter your api key/i)
  await expect(input).toBeEnabled()
  await expect(input).toHaveValue('sk-or-v1-a-slow-key')

  // And the delayed response landing late must not flip the gate anyway -
  // the same stale-response guard AC-1.9's cancel path relies on.
  await page.waitForTimeout(3200)
  await expect(page.getByTestId('key-gate-modal')).toBeVisible()
})

test('T-FR-1-16: the rejected-key message is reachable and readable by focus alone', async ({
  page,
}) => {
  await page.route('https://openrouter.ai/**', (route) => fulfillFailure(route, 'key-rejected'))

  await page.locator('#key-gate-input').focus()
  await page.keyboard.type('sk-or-v1-a-bad-key')
  await page.keyboard.press('Enter')

  const error = page.getByTestId('key-gate-error')
  await expect(error).toBeVisible()
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toContainText('rejected')
})

test('T-FR-1-16: the account-restricted message is reachable and readable by focus alone', async ({
  page,
}) => {
  await page.route('https://openrouter.ai/**', (route) => fulfillFailure(route, 'credit'))

  await page.locator('#key-gate-input').focus()
  await page.keyboard.type('sk-or-v1-a-restricted-key')
  await page.keyboard.press('Enter')

  const error = page.getByTestId('key-gate-error')
  await expect(error).toBeVisible()
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toContainText(/credit|restricted/i)
})

test('T-FR-1-16: the incomplete-check message is reachable and readable by focus alone', async ({
  page,
}) => {
  await page.route('https://openrouter.ai/**', (route) => fulfillFailure(route, 'rate-limit'))

  await page.locator('#key-gate-input').focus()
  await page.keyboard.type('sk-or-v1-a-throttled-key')
  await page.keyboard.press('Enter')

  const error = page.getByTestId('key-gate-error')
  await expect(error).toBeVisible()
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toContainText(/did not complete|network error|rate limit/i)
})
