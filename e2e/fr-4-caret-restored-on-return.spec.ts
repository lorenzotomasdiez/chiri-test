import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-4-7: The caret returns to a sensible position, not an arbitrary offset', async ({
  page,
}) => {
  // Set up a four-paragraph document with the third paragraph being "The quick fox ran."
  const editor = page.locator('[data-testid="editor"]')
  await editor.click()

  // Type the document content: three paragraphs, then the target paragraph
  await page.keyboard.type('First paragraph.\n\nSecond paragraph.\n\n')

  // Type the third paragraph where we will place the caret
  await page.keyboard.type('The quick fox ran.')

  // Add a fourth paragraph
  await page.keyboard.type('\n\nFourth paragraph.')

  // Place the caret between "quick" and " fox" by clicking at that position
  // We need to find the position of "quick" in the text and click right after it
  const contentElement = page.locator('[data-testid="editor"] .cm-content')
  const boundingBox = await contentElement.boundingBox()

  if (!boundingBox) {
    throw new Error('Could not find editor content bounding box')
  }

  // Move the cursor to the beginning of the document
  await page.keyboard.press('Control+Home')

  // Navigate to the third paragraph and position caret after "quick"
  // "First paragraph." = 16 chars
  // "\n\n" = 2 chars
  // "Second paragraph." = 17 chars
  // "\n\n" = 2 chars
  // "The " = 4 chars
  // "quick" = 5 chars, so position is at offset 16 + 2 + 17 + 2 + 4 + 5 = 46
  const caretOffset = 46

  // Use keyboard navigation to get to the exact position
  await page.keyboard.press('Control+Home')
  for (let i = 0; i < caretOffset; i++) {
    await page.keyboard.press('ArrowRight')
  }

  // Wait a moment for any persistence to occur
  await page.waitForTimeout(500)

  // Verify the caret is at the correct position before reload
  const selectionBefore = await page.evaluate(() => {
    const editor = (window as any).__editor
    return editor?.state?.selection?.main?.head
  })
  expect(selectionBefore).toBe(caretOffset)

  // Reload the page to restore from persisted state
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // Verify the caret is restored to the correct offset in the third paragraph
  const selectionAfter = await page.evaluate(() => {
    const editor = (window as any).__editor
    return editor?.state?.selection?.main?.head
  })
  expect(selectionAfter).toBe(caretOffset)

  // Type "X" and verify it appears in the correct position
  await page.keyboard.type('X')

  // Get the full text content and verify "X" appears between "quick" and " fox"
  const fullText = await page.evaluate(() => {
    const editor = (window as any).__editor
    return editor?.state?.doc?.toString?.()
  })

  // The text should contain "quickX fox" in the third paragraph
  expect(fullText).toContain('quickX fox')
})
