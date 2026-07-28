import { test, expect } from '@playwright/test'

/**
 * The gate-bound half of AC-2.4.
 *
 * T-CC-SPLASH-3 already covers the editor-bound half: with a key on file the
 * launch state hands off to the editor, and keystrokes typed during the dwell
 * arrive in the document. Nothing covered the other branch - no key on file,
 * so the launch state hands off to the key gate instead (AC-2.3), which
 * autofocuses its input on mount (KeyGateModal.tsx). That combination is the
 * one that can silently push a buffered "hello" into the API key field.
 *
 * Timing is stated rather than raced. A journey that types with real key
 * delays against a 1200ms dwell cannot prove which surface was up when each
 * keystroke landed, so a slow harness reports a product bug that is really an
 * artefact. Here the splash check and the keystrokes happen inside a single
 * evaluate, so they cannot straddle the transition, and the assertion is only
 * ever about input that provably arrived during the launch state.
 */
test('T-FR-2-9: keystrokes typed during the launch state replay into the document, never into the key gate field (AC-2.3, AC-2.4)', async ({
  page,
}) => {
  // No seedValidatedKey: AC-2.3's other branch, where the gate comes next.
  await page.goto('/')
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  // One evaluate, one tick: confirm the launch screen is up and type into it
  // without yielding to the event loop in between. React cannot unmount the
  // splash mid-way through, so every keystroke below is provably a
  // launch-state keystroke - which is exactly what AC-2.4 is about.
  const typedDuringLaunch = await page.evaluate(() => {
    if (!document.querySelector('[data-testid="launch-splash"]')) return false
    for (const key of 'hello') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    }
    return !!document.querySelector('[data-testid="launch-splash"]')
  })
  expect(typedDuringLaunch).toBe(true)

  // AC-2.3: with no key on file the launch state ends on the gate.
  await expect(page.getByTestId('key-gate-modal')).toBeVisible()

  // The gate autofocuses its input, so this is the field the buffered text
  // would land in if the replay targeted whatever happens to hold focus.
  // "hello" is not an API key and must never be offered as one.
  await expect(page.locator('#key-gate-input')).toHaveValue('')

  // AC-2.4: not lost either - the document is where it belongs, even though
  // the document is not yet editable behind the gate.
  const doc = await page.evaluate(
    () =>
      (window as unknown as { __editor?: { state: { doc: { toString(): string } } } }).__editor
        ?.state.doc.toString(),
  )
  expect(doc).toBe('hello')
})
