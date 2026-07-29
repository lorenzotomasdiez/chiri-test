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

test('T-FR-5-28: Tab is not swallowed when there is no continuation to accept', async ({ page }) => {
  // Tab is bound to accept only while an offer is showing. With nothing to
  // accept it must fall through to the browser's own focus traversal, or a
  // keyboard-only writer is trapped in the editor - the exact failure this
  // binding risks.
  //
  // What is asserted is whether the keystroke was consumed, not where focus
  // ended up. The editor is the last focusable thing on the page, so Tab
  // hands focus to the browser's own chrome, and the browsers disagree about
  // what document.activeElement reads as afterwards: Chromium reports body,
  // Firefox leaves it pointing at the element that had focus. Neither answer
  // says anything about whether the editor swallowed the key - preventDefault
  // does, in every browser.
  await mockOpenRouter(page, { continuation: ' something.' })

  await page.evaluate(() => {
    const seen: boolean[] = []
    ;(window as unknown as { __tabPrevented: boolean[] }).__tabPrevented = seen
    // Bubble phase on window, so this runs after the editor's own handler has
    // had its say about the event.
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') seen.push(event.defaultPrevented)
    })
  })

  await page.keyboard.type('A line with no offer showing yet')

  const editorHadFocus = await page.evaluate(() =>
    document.activeElement?.classList.contains('cm-content'),
  )
  expect(editorHadFocus, 'the editor should have focus before Tab').toBe(true)

  // Dismiss any pending offer first, so this asserts the no-ghost path.
  await page.keyboard.press('ArrowLeft')
  expect(await ghostText(page)).toBeNull()

  const before = await snapshot(page)
  await page.keyboard.press('Tab')

  const prevented = await page.evaluate(
    () => (window as unknown as { __tabPrevented: boolean[] }).__tabPrevented,
  )
  expect(prevented, 'exactly one Tab keydown should have been seen').toHaveLength(1)
  expect(prevented[0], 'Tab with no offer showing must not be consumed by the editor').toBe(false)

  // And it certainly must not have edited the document - no tab character,
  // no accepted continuation.
  const after = await snapshot(page)
  expect(after.doc).toBe(before.doc)
  expect(after.caret).toBe(before.caret)
})
