/**
 * T-FR-1-21: the editor's inertness (AC-1.1) is a single derivation -
 * `editable={unblocked}` in src/App.tsx - so it should already hold across
 * every blocked sub-state uniformly. This spec asserts that directly rather
 * than trusting the derivation, since a future change that branches
 * inertness per keyGateState (rather than on the one unblocked boolean)
 * could silently leave one sub-state typable and nothing here would have
 * caught it.
 */

import { test, expect } from '@playwright/test'

async function probeEditorInertness(page: import('@playwright/test').Page) {
  // The direct, unambiguous check: CodeMirror's own contenteditable flag,
  // which is exactly what src/components/Editor.tsx's editable/readOnly
  // compartment controls. Click-then-check-focus is not a reliable substitute
  // here - the gate card visually overlaps the editor column's centre, so a
  // forced click can land on the card itself regardless of whether the
  // editor beneath is actually editable, which would make that assertion
  // pass for the wrong reason.
  const contentEditable = await page.locator('.cm-content').getAttribute('contenteditable')
  expect(contentEditable).toBe('false')

  await page.locator('.cm-content').click({ force: true })
  const clickFocusedEditor = await page.evaluate(() => {
    const active = document.activeElement
    const cmContent = document.querySelector('.cm-content')
    return !!active && !!cmContent && cmContent.contains(active)
  })
  expect(clickFocusedEditor).toBe(false)

  await page.keyboard.type('should not appear')
  const docText = await page.locator('.cm-content').textContent()
  expect(docText).not.toContain('should not appear')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
  })
})

test('T-FR-1-21: the editor stays inert through blocked-empty, validating, and blocked-error', async ({
  page,
}) => {
  // blocked-empty: no key submitted yet.
  await page.goto('/')
  await expect(page.getByTestId('key-gate-modal')).toBeVisible()
  await probeEditorInertness(page)

  // validating: a submitted key whose response is held open.
  let releaseResponse: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  await page.route('https://openrouter.ai/**', async (route) => {
    await held
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  await page.locator('#key-gate-input').fill('sk-or-v1-test-key')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('key-gate-status')).toBeVisible()
  await expect(page.getByTestId('key-gate-status')).toContainText('Checking your key')
  await probeEditorInertness(page)

  // blocked-error: the held response now resolves as a rejection.
  releaseResponse?.()
  await expect(page.getByTestId('key-gate-error')).toBeVisible()
  await probeEditorInertness(page)
})
