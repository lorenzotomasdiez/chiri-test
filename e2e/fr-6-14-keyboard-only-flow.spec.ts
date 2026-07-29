import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { mockRevisionResponse } from './openrouter-mock'
import type { EditorView } from '@codemirror/view'

/**
 * T-FR-6-14: The entire revision flow is operable by keyboard alone (AC-6.15).
 *
 * Every other fr-6 spec raises the action bar by dispatching a selection
 * directly through the CM6 API and drives it with `.click()`, so nothing in
 * this branch's own worktree ever proved a real user could reach these
 * controls with nothing but a keyboard: extending the selection with
 * Shift+ArrowRight, tabbing from the document into the floating bar, firing
 * a one-tap action with Enter, then tabbing through the resulting revision
 * widget's own Refine and Accept controls and firing those with the
 * keyboard too. The screen-reader-announcement half of AC-6.15 stays a
 * manual four-browser pass per the blueprint's testing seams, not asserted
 * here.
 */

async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

async function focusedTestId(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null)
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-6-14: selecting, raising the bar, and accepting a revision all work by keyboard alone', async ({
  page,
}) => {
  const fullDoc = 'The report was late because the team was busy.'

  // The only pointer use in this spec: establishing initial focus in the
  // document, exactly as every other fr-6 spec does before it starts typing.
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)
  expect(await docText(page)).toBe(fullDoc)

  // Extend the selection with Shift+ArrowRight alone, per AC-6.15's own
  // wording, rather than dispatching the selection programmatically. The
  // whole sentence is selected (not a short fragment) so the proposed
  // replacement below cannot trip AC-6.9's containment check by mentioning
  // words that live outside a narrower span.
  await page.keyboard.press('Home')
  for (let i = 0; i < fullDoc.length; i++) {
    await page.keyboard.press('Shift+ArrowRight')
  }
  const selected = await page.evaluate(() => {
    const s = (window as unknown as { __editor: EditorView }).__editor.state
    return s.doc.sliceString(s.selection.main.from, s.selection.main.to)
  })
  expect(selected).toBe(fullDoc)

  const bar = page.locator('[data-testid="selection-action-bar"]')
  await expect(bar).toBeVisible()

  // Tab out of the document and into the bar's first control, exactly the
  // path a keyboard-only user has to take - no click ever touches the bar.
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-testid="action-ask-ai"]')).toBeFocused()

  // Tab past "Ask AI" into the one-tap chip row until "Improve the writing"
  // itself has focus, then fire it with Enter rather than a click.
  let guard = 0
  while ((await focusedTestId(page)) !== 'action-improve-writing') {
    await page.keyboard.press('Tab')
    guard++
    expect(guard).toBeLessThan(10)
  }

  await mockRevisionResponse(page, {
    reason: 'Vague cause',
    proposal: 'The report slipped because the team had competing priorities.',
  })

  await page.keyboard.press('Enter')

  const decoration = page.locator('[data-testid="revision-decoration"]')
  await expect(decoration).toBeVisible()

  // Tab through the widget until the Refine control has focus, and fire it
  // with the keyboard: per the widget's own contract this moves focus onto
  // the refinement instruction input without a click.
  guard = 0
  while ((await focusedTestId(page)) !== 'revision-refine') {
    await page.keyboard.press('Tab')
    guard++
    expect(guard).toBeLessThan(10)
  }
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid="refinement-instruction-input"]')).toBeFocused()

  // Escape backs out of the refine turn without submitting or losing the
  // pending revision (T-FR-7-5), leaving Accept and Reject still reachable.
  await page.keyboard.press('Escape')
  await expect(decoration).toBeVisible()

  // Tab from the document back to Accept and fire it with the keyboard.
  await page.keyboard.press('Tab')
  guard = 0
  while ((await focusedTestId(page)) !== 'revision-accept') {
    await page.keyboard.press('Tab')
    guard++
    expect(guard).toBeLessThan(10)
  }
  await page.keyboard.press('Enter')

  await expect(decoration).toHaveCount(0)
  expect(await docText(page)).toBe(
    'The report slipped because the team had competing priorities.',
  )
})

test('T-FR-6-14: rejecting a revision is triggerable by keyboard alone', async ({ page }) => {
  const fullDoc = 'The report was late because the team was busy.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')

  const bar = page.locator('[data-testid="selection-action-bar"]')
  await expect(bar).toBeVisible()

  await mockRevisionResponse(page, {
    reason: 'Vague cause',
    proposal: 'The report slipped because the team had competing priorities.',
  })

  await page.keyboard.press('Tab')
  let guard = 0
  while ((await focusedTestId(page)) !== 'action-improve-writing') {
    await page.keyboard.press('Tab')
    guard++
    expect(guard).toBeLessThan(10)
  }
  await page.keyboard.press('Enter')

  const decoration = page.locator('[data-testid="revision-decoration"]')
  await expect(decoration).toBeVisible()

  await page.keyboard.press('Tab')
  guard = 0
  while ((await focusedTestId(page)) !== 'revision-reject') {
    await page.keyboard.press('Tab')
    guard++
    expect(guard).toBeLessThan(10)
  }
  await page.keyboard.press('Enter')

  await expect(decoration).toHaveCount(0)
  expect(await docText(page)).toBe(fullDoc)
})
