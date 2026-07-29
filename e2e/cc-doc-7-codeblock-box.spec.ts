import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

/**
 * CC-DOC.7: fenced code blocks render as one boxed shape - container fill,
 * 16px padding, a 4px radius, a 30% hairline border - and scroll
 * horizontally within themselves rather than wrapping like prose.
 *
 * livePreview.ts decorates each line of a fence individually (CodeMirror has
 * no native "wrap N lines in one box" primitive), so this asserts the box
 * reads as one shape: the first/last line each carry the top/bottom edge
 * (radius + border + padding) and every line shares the side borders/fill,
 * rather than every line drawing its own full border.
 */

function alphaOf(color: string): number {
  const slash = color.match(/\/\s*([\d.]+)\s*\)$/)
  if (slash) return Number(slash[1])
  const comma = color.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)$/)
  return comma ? Number(comma[1]) : 1
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  await page.locator('.cm-content').click()
})

test('T-CC-DOC-7-1: a multi-line fenced code block renders as one boxed shape with horizontal scroll', async ({
  page,
}) => {
  await page.keyboard.type('```')
  await page.keyboard.press('Enter')
  await page.keyboard.type('first line of code')
  await page.keyboard.press('Enter')
  await page.keyboard.type(
    'a very long single line that should scroll horizontally instead of wrapping onto a second visual row xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  )
  await page.keyboard.press('Enter')
  await page.keyboard.type('```')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  const lines = page.locator('.cm-lp-codeblock')
  await expect(lines).toHaveCount(4)

  const first = lines.first()
  const last = lines.last()

  // Container fill, per CC-DOC.7 (matches --color-container elsewhere).
  await expect(first).toHaveCSS('background-color', 'rgb(241, 237, 236)')

  // Radius and the box's outer edges sit only on the first/last line.
  const firstRadius = await first.evaluate(
    (el) => getComputedStyle(el).borderTopLeftRadius,
  )
  expect(firstRadius).toBe('4px')
  const lastRadius = await last.evaluate(
    (el) => getComputedStyle(el).borderBottomLeftRadius,
  )
  expect(lastRadius).toBe('4px')

  const firstPaddingTop = await first.evaluate((el) => getComputedStyle(el).paddingTop)
  expect(firstPaddingTop).toBe('16px')
  const lastPaddingBottom = await last.evaluate(
    (el) => getComputedStyle(el).paddingBottom,
  )
  expect(lastPaddingBottom).toBe('16px')

  // A 30% hairline border on every edge of the box, not the full-strength
  // divider color.
  const sideBorderColor = await first.evaluate((el) => getComputedStyle(el).borderLeftColor)
  const alpha = alphaOf(sideBorderColor)
  expect(alpha).toBeGreaterThanOrEqual(0.1)
  expect(alpha).toBeLessThanOrEqual(0.3)

  // The long middle line scrolls horizontally rather than wrapping - if it
  // wrapped, its rendered box height would match the short first/last lines
  // instead of exceeding them.
  const middle = lines.nth(2)
  const middleBox = await middle.boundingBox()
  const firstBox = await first.boundingBox()
  expect(middleBox).not.toBeNull()
  expect(firstBox).not.toBeNull()
  if (middleBox && firstBox) {
    expect(middleBox.height).toBeLessThanOrEqual(firstBox.height + 2)
  }
  const overflowX = await middle.evaluate((el) => getComputedStyle(el).overflowX)
  expect(overflowX).toBe('auto')
})
