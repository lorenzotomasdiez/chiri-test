import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

/**
 * CC-DOC.9: "Text selection is rendered as the ink at 10% opacity. It is never
 * a blue system highlight." CC-COLOR.1 admits no hue but the near-black ink
 * and the single error red.
 *
 * The `::selection` rule in src/index.css is not what settles this inside the
 * editor: the `drawSelection()` extension replaces the native browser
 * highlight with its own `.cm-selectionBackground` layer, which `::selection`
 * never reaches. So this reads the colour off the element that is actually
 * painted, through a selection made the way a writer makes one.
 */

/** The ink at 10%, exactly as ::selection states it in src/index.css. */
const INK_10 = 'rgba(29, 29, 31, 0.1)'

function parseRgb(value: string): { r: number; g: number; b: number } {
  const parts = value.match(/[\d.]+/g)
  if (!parts || parts.length < 3) throw new Error(`unparseable colour: ${value}`)
  return { r: Number(parts[0]), g: Number(parts[1]), b: Number(parts[2]) }
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('CC-DOC.9: A selection is painted as the ink at 10%, never a blue highlight', async ({
  page,
}) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type('The cabin sat quiet under the first snow.')

  // A real selection, made with the keyboard the way a writer makes one -
  // not a dispatched CM6 transaction, since the point here is what the
  // browser ends up painting.
  await page.keyboard.press('Shift+Home')

  const layer = page.locator('.cm-selectionLayer .cm-selectionBackground').first()
  await expect(layer).toBeAttached()

  // The editor keeps focus through all of this, which is the state the base
  // theme paints its lavender in - the case the unfocused rule alone misses.
  expect(
    await page.evaluate(() => document.activeElement?.classList.contains('cm-content')),
  ).toBe(true)

  const background = await layer.evaluate((el) => getComputedStyle(el).backgroundColor)

  expect(background, 'the selection must be the ink at 10% opacity').toBe(INK_10)

  // Stated separately from the equality above so a regression to any other
  // hue reports as the CC-COLOR.1 violation it is rather than as a near miss.
  // The ink is a near-neutral - its channels sit within a couple of points of
  // each other - where any system highlight blue spreads them far apart. The
  // default this replaced, rgb(215, 212, 240), spreads by 28.
  const { r, g, b } = parseRgb(background)
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  expect(spread, 'a neutral ink, not a blue highlight').toBeLessThanOrEqual(4)
})

test('CC-DOC.9: The caret is the ink, not the base theme black', async ({ page }) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type('A line to put a caret in.')

  const cursor = page.locator('.cm-cursorLayer .cm-cursor').first()
  await expect(cursor).toBeAttached()

  const borderColor = await cursor.evaluate((el) => getComputedStyle(el).borderLeftColor)
  expect(borderColor, 'the caret is drawn by drawSelection, so it needs the ink too').toBe(
    'rgb(29, 29, 31)',
  )
})
