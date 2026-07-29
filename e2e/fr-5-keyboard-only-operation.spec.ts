import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { ghostText, mockOpenRouter, snapshot, waitForGhost } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/**
 * The automatable half of T-FR-5-28. The screen-reader announcement half is a
 * manual VoiceOver/NVDA pass per the blueprint's open question 7, and is
 * deliberately not faked with an assertion here - an aria attribute being
 * present is not the same claim as an announcement being made.
 *
 * What is asserted here is the part a machine can actually settle: that the
 * whole offer can be accepted and dismissed without a pointer ever being
 * used, and that binding Tab to accept has not cost the editor its ordinary
 * focus traversal when there is nothing to accept.
 */
test('T-FR-5-28: A shown continuation is fully operable without a pointer', async ({ page }) => {
  const initialDoc = 'The cabin sat quiet under the first snow, and'
  const continuation = ' the road out had vanished.'

  await mockOpenRouter(page, { continuation })

  // No click anywhere in this test. The editor focuses itself at mount, which
  // is the same thing a keyboard-only writer gets on arrival.
  await page.keyboard.type(initialDoc)
  await waitForGhost(page)
  expect(await ghostText(page)).toBe(continuation)

  // Dismiss with the keyboard alone.
  await page.keyboard.press('ArrowLeft')
  const afterDismiss = await snapshot(page)
  expect(afterDismiss.ghost).toBeNull()
  expect(afterDismiss.ghostWidgets).toBe(0)
  expect(afterDismiss.doc).toBe(initialDoc)

  // Bring the offer back and accept it with the keyboard alone.
  await page.keyboard.press('End')
  await waitForGhost(page)
  await page.keyboard.press('Tab')

  const afterAccept = await snapshot(page)
  expect(afterAccept.doc).toBe(initialDoc + continuation)
  expect(afterAccept.ghost).toBeNull()
  expect(afterAccept.caret).toBe((initialDoc + continuation).length)
})

test('T-FR-5-28: Tab still leaves the editor when there is no continuation to accept', async ({
  page,
}) => {
  // Tab is bound to accept only while an offer is showing. With nothing to
  // accept it must fall through, or a keyboard-only writer is trapped in the
  // editor with no way out - the exact failure the binding risks.
  await mockOpenRouter(page, { continuation: ' something.' })

  await page.keyboard.type('A line with no offer showing yet')

  const editorHadFocus = await page.evaluate(() =>
    document.activeElement?.classList.contains('cm-content'),
  )
  expect(editorHadFocus, 'the editor should have focus before Tab').toBe(true)

  // Dismiss any pending offer first, so this asserts the no-ghost path.
  await page.keyboard.press('ArrowLeft')
  expect(await ghostText(page)).toBeNull()

  await page.keyboard.press('Tab')

  const stillInEditor = await page.evaluate(() =>
    document.activeElement?.classList.contains('cm-content'),
  )
  expect(stillInEditor, 'Tab with no offer showing must not be swallowed by the editor').toBe(false)
})
