/**
 * T-FR-6-5: Clearing the selection dismisses the bar without issuing a
 * request.
 *
 * The action bar must be purely a function of the current selection - once
 * the user collapses it without picking an action, nothing should have been
 * dispatched to the model. This is untested anywhere else: every other FR-6
 * spec that reaches a collapsed selection (T-FR-6-17) starts from one, it
 * never raises the bar first and then clears it.
 */

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-6-5: collapsing a selection dismisses the bar and never calls the model', async ({
  page,
}) => {
  const text = 'The report was late because the team was busy.'

  let requestCount = 0
  await page.route('https://openrouter.ai/**', async (route) => {
    requestCount += 1
    await route.fulfill({ status: 500, body: '' })
  })

  await page.locator('.cm-content').click()
  await page.keyboard.type(text)

  // Select "the team was busy" (offsets 28-46) - the action bar appears.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 28, head: 46 } })
  })

  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  await expect(actionBar).toBeVisible()

  // Collapse the selection without choosing any action, as clicking
  // elsewhere in the document would.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 10, head: 10 } })
  })

  await expect(actionBar).toHaveCount(0)

  // Give any accidental in-flight dispatch a chance to reach the route
  // before asserting it never did.
  await page.waitForTimeout(300)
  expect(requestCount).toBe(0)

  // No revision ever appeared, and the document is untouched.
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  await expect(page.locator('.cm-content')).toHaveText(text)
})
