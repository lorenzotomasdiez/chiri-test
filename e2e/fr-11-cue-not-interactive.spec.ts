import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Check if an element has the tabindex attribute */
async function elementHasTabindex(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate(
    (sel) => document.querySelector(sel)?.hasAttribute('tabindex'),
    selector,
  )
}

/** Get the currently focused element's data-testid attribute if any */
async function focusedElementTestId(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-11-3: the cue is not interactive and never blocks input', async ({ page }) => {
  // Verify the cue is visible in an empty document
  const cueLocator = page.locator('[data-testid="onboarding-cue"]')
  await expect(cueLocator).toHaveCount(1)
  const cueText = await cueLocator.textContent()
  expect(cueText).toBe('Start writing. When grey text appears, press Tab to take it.')

  // Verify the cue has no tabindex attribute
  const cueHasTabindex = await elementHasTabindex(page, '[data-testid="onboarding-cue"]')
  expect(cueHasTabindex).toBe(false)

  // Click the cue's text at its center
  const cueBoundingBox = await cueLocator.boundingBox()
  expect(cueBoundingBox).not.toBeNull()
  const centerX = cueBoundingBox!.x + cueBoundingBox!.width / 2
  const centerY = cueBoundingBox!.y + cueBoundingBox!.height / 2
  await page.mouse.click(centerX, centerY)

  // The cue is still visible and unchanged (pointer-events-none allowed click to pass through)
  await expect(cueLocator).toHaveCount(1)
  expect(await cueLocator.textContent()).toBe(cueText)

  // document.activeElement is inside .cm-content, proving click passed through the cue
  const isInCmContent = await page.evaluate(
    () => document.activeElement?.closest('.cm-content') !== null,
  )
  expect(isInCmContent).toBe(true)

  // Press Tab and Enter without typing - focus should not be trapped on the cue
  await page.keyboard.press('Tab')
  expect(await focusedElementTestId(page)).not.toBe('onboarding-cue')
  await page.keyboard.press('Enter')

  // None of that changed the cue's own state
  await expect(cueLocator).toHaveCount(1)
  expect(await cueLocator.textContent()).toBe(cueText)

  // Clicking back into the editor and typing 'A' goes into the document
  // immediately, with no dismissal step of its own
  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type('A')
  expect(await docText(page)).toBe('A')

  // Cue is now hidden since the document is no longer empty
  await expect(cueLocator).toHaveCount(0)
})
