import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  await page.setViewportSize({ width: 1280, height: 800 })
})

test('T-CC-SHELL-2: Single centred column with correct dimensions and no rejected chrome elements', async ({
  page,
}) => {
  // Type the test content
  await page.locator('.cm-content').click()
  await page.keyboard.type('# Why Remote Teams Struggle\n\nThe shift to remote work was supposed to liberate our schedules.')

  // Verify the content is in the editor
  expect(await docText(page)).toBe('# Why Remote Teams Struggle\n\nThe shift to remote work was supposed to liberate our schedules.')

  // Get the main content column (the <main> element)
  const mainColumn = page.locator('main')
  const boundingBox = await mainColumn.boundingBox()

  // Assert column width is 672px (max-width 42rem)
  expect(boundingBox?.width).toBe(672)

  // Assert column is horizontally centred: x should be 304 (+/-1) at 1280 width
  expect(boundingBox?.x).toBeGreaterThanOrEqual(303)
  expect(boundingBox?.x).toBeLessThanOrEqual(305)

  // Assert content begins 96px from top
  expect(boundingBox?.y).toBe(0) // The main is at top, check padding-top on the editor container

  // Check computed styles: no card styling
  const bgColor = await mainColumn.evaluate(el => window.getComputedStyle(el).backgroundColor)
  expect(
    bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'rgb(253, 248, 248)'
  ).toBeTruthy()

  const borderWidth = await mainColumn.evaluate(el => window.getComputedStyle(el).borderWidth)
  expect(borderWidth).toBe('0px')

  const boxShadow = await mainColumn.evaluate(el => window.getComputedStyle(el).boxShadow)
  expect(boxShadow).toBe('none')

  // Assert no sidebar/complementary elements exist
  const asideCount = await page.locator('aside').count()
  expect(asideCount).toBe(0)

  const complementaryCount = await page.locator('[role="complementary"]').count()
  expect(complementaryCount).toBe(0)

  const tablistCount = await page.locator('[role="tablist"]').count()
  expect(tablistCount).toBe(0)

  // Assert no second navigation or tree roles
  const navRoles = await page.locator('[role="navigation"]').count()
  expect(navRoles).toBeLessThanOrEqual(1)

  const treeRoles = await page.locator('[role="tree"]').count()
  expect(treeRoles).toBe(0)

  // Assert no horizontal scrolling
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth !== document.documentElement.clientWidth
  )
  expect(hasHorizontalScroll).toBe(false)

  // Assert no rejected content elements
  const pageText = await page.textContent('body')
  expect(pageText).not.toMatch(/\d+\s+words/)
  expect(pageText).not.toContain('Saved to Cloud')

  // Assert no .md filename tooltip beneath the top bar
  const mdTooltip = await page.locator('[title*=".md"]').count()
  expect(mdTooltip).toBe(0)

  // Assert column opacity settles at 1 once CC-MOTION.3's one-time shell
  // entry fade finishes, when the pointer is not near it
  await expect(mainColumn).toHaveCSS('opacity', '1')

  // Assert at least 128px of trailing space beneath the last line
  const lastLineBottomDistance = await mainColumn.evaluate(el => {
    const rect = el.getBoundingClientRect()
    const editorHeight = rect.height
    const lastChildRect = el.lastElementChild?.getBoundingClientRect()
    if (!lastChildRect) return 0
    return editorHeight - (lastChildRect.bottom - rect.top)
  })
  expect(lastLineBottomDistance).toBeGreaterThanOrEqual(128)
})
