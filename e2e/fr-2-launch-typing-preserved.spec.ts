// NOTE: This test contradicts the currently-passing T-CC-SPLASH-3 at launch-splash.spec.ts:71,
// which asserts doc === '' after typing during dwell. T-CC-SPLASH-3 tests the old behavior
// (input is lost to the transition), while T-FR-2-8 tests the new FR-2 plan behavior
// (input is preserved via keystroke buffering). The implementer will reconcile these:
// T-CC-SPLASH-3 must be updated to reflect the new behavior (keystrokes replayed), or its
// intent must be clarified to test what it was really guarding (no dismissal, no skip-ahead).
// Do not weaken this test to make both pass.

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test('T-FR-2-8: typing during the launch state loses no input (AC-2.4)', async ({ page }) => {
  // Given a seeded valid key so the next surface is the editor
  await seedValidatedKey(page)
  await page.goto('/')

  // Verify the splash is on screen and the dwell has not yet elapsed
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  // When the user types during the dwell window
  await page.keyboard.type('hello')

  // The splash is still visible (no dismissal affordance exists, typing does not skip ahead)
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  // Wait for the dwell to elapse and the transition to complete
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)

  // Then the keystrokes are replayed into the editor document, not lost (AC-2.4)
  const doc = await page.evaluate(
    () => (window as unknown as { __editor?: { state: { doc: { toString(): string } } } }).__editor?.state.doc.toString(),
  )
  expect(doc).toBe('hello')
})
