import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-CC-TOGGLE-1: Predictions toggle is a real button whose knob carries the state, and toggling disturbs no committed text', async ({
  page,
}) => {
  // Type the test text
  await page.locator('.cm-content').click()
  await page.keyboard.type('Momentum matters more than polish.')

  // Find the toggle button
  const toggleButton = page.getByRole('button', { name: /Predictions/ })

  // CC-TOGGLE.6: Verify it's a real button with aria-pressed="true" by default
  await expect(toggleButton).toHaveAttribute('aria-pressed', 'true')

  // Get the pill element (the toggle's visual container)
  const pill = toggleButton.locator('div').first()

  // CC-TOGGLE dimensions and shape: 32px wide, 16-18px tall, fully rounded
  const pillBox = await pill.boundingBox()
  expect(pillBox?.width).toBe(32)
  expect(pillBox?.height).toBeGreaterThanOrEqual(16)
  expect(pillBox?.height).toBeLessThanOrEqual(18)

  const borderRadius = await pill.evaluate(el =>
    window.getComputedStyle(el).borderRadius,
  )
  expect(borderRadius).toBe('9999px')

  // CC-TOGGLE.3: Fill colour is the ink token rgb(29, 29, 31)
  const fillColor = await pill.evaluate(el => window.getComputedStyle(el).backgroundColor)
  expect(fillColor).toBe('rgb(29, 29, 31)')

  // Get the knob element (12px round white)
  const knob = toggleButton.locator('div').nth(1)
  const knobBox = await knob.boundingBox()

  // Calculate centre positions for the on state
  const pillCentreX = pillBox!.x + pillBox!.width / 2
  const knobCentreX = knobBox!.x + knobBox!.width / 2

  // CC-TOGGLE.5: When on, knob centre x > pill centre x (knob on the right)
  expect(knobCentreX).toBeGreaterThan(pillCentreX)

  // Verify the knob is white and 12px round
  const knobColor = await knob.evaluate(el => window.getComputedStyle(el).backgroundColor)
  expect(knobColor).toBe('rgb(255, 255, 255)')

  expect(knobBox?.width).toBe(12)
  expect(knobBox?.height).toBe(12)

  // CC-TOGGLE.4, CC-MOTION.5: Transition duration is 0.2s
  const transitionDuration = await pill.evaluate(el =>
    window.getComputedStyle(el).transitionDuration,
  )
  expect(transitionDuration).toBe('0.2s')

  // Record text and styling before toggle
  const textBefore = await docText(page)
  const cmLineBeforeToggle = page.locator('.cm-line').first()
  const colorBefore = await cmLineBeforeToggle.evaluate(el =>
    window.getComputedStyle(el).color,
  )
  const fontSizeBefore = await cmLineBeforeToggle.evaluate(el =>
    window.getComputedStyle(el).fontSize,
  )

  // Click the button to toggle
  await toggleButton.click()

  // CC-TOGGLE.6: aria-pressed becomes "false"
  await expect(toggleButton).toHaveAttribute('aria-pressed', 'false')

  // CC-TOGGLE.3, CC-TOGGLE.5: Fill becomes hairline colour rgb(199, 198, 202)
  const fillColorOff = await pill.evaluate(el => window.getComputedStyle(el).backgroundColor)
  expect(fillColorOff).toBe('rgb(199, 198, 202)')

  // Recalculate knob position after toggle
  const knobBoxAfter = await knob.boundingBox()
  const knobCentreXAfter = knobBoxAfter!.x + knobBoxAfter!.width / 2

  // When off, knob centre x < pill centre x (knob on the left)
  expect(knobCentreXAfter).toBeLessThan(pillCentreX)

  // CC-TOGGLE.7: Text is unchanged
  expect(await docText(page)).toBe(textBefore)
  expect(await docText(page)).toBe('Momentum matters more than polish.')

  // CC-TOGGLE.7: Text colour and font-size are unchanged
  const cmLineAfterToggle = page.locator('.cm-line').first()
  const colorAfter = await cmLineAfterToggle.evaluate(el =>
    window.getComputedStyle(el).color,
  )
  const fontSizeAfter = await cmLineAfterToggle.evaluate(el =>
    window.getComputedStyle(el).fontSize,
  )

  expect(colorAfter).toBe(colorBefore)
  expect(fontSizeAfter).toBe(fontSizeBefore)
})
