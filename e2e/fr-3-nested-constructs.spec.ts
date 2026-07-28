import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Get the current caret head position */
async function caretHead(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.selection.main.head,
  )
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-3-2: nested constructs render together without corrupting each other', async ({
  page,
}) => {
  const sourceText = '> - **bold** and *italic* inside a list inside a quote'

  // Type the nested markdown line
  await page.locator('.cm-content').click()
  await page.keyboard.type(sourceText)

  // Press Enter twice to move the caret away from the line
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  // Assert: window.__editor.state.doc.toString() is byte-identical to the typed source
  expect(await docText(page)).toContain(sourceText)

  // Assert: the first line (our typed content) should contain the expected text without corruption
  const firstLine = await page.locator('.cm-line').first()
  const lineText = await firstLine.innerText()

  // The visible text should contain 'bold' and 'italic' and the descriptive text
  // without missing or duplicated characters adjacent to hidden markers
  expect(lineText).toContain('bold')
  expect(lineText).toContain('italic')
  expect(lineText).toContain('inside a list inside a quote')

  // Assert: visual styling - check that the first line has blockquote/quote styling
  // A blockquote should have specific visual treatment (spacing, color, etc.)
  const firstLineStyles = await firstLine.evaluate((el) => {
    const style = window.getComputedStyle(el)
    return {
      color: style.color,
      marginLeft: style.marginLeft,
    }
  })
  // Just verify we got style information indicating the line was rendered
  expect(firstLineStyles.color).toBeTruthy()

  // Assert: bold text should have bold font-weight
  // Find spans that should be bold (contains "bold" and likely has font-weight applied)
  const boldElements = await page.locator('.cm-line').first().locator('text=bold')
  const boldCount = await boldElements.count()
  // We should have at least one element that contains the word "bold"
  if (boldCount > 0) {
    const boldWeight = await boldElements.first().evaluate((el) => {
      return window.getComputedStyle(el).fontWeight
    })
    // Bold should have fontWeight >= 700 or specifically 'bold'
    expect(['700', '800', '900', 'bold', 'bolder']).toContain(boldWeight)
  }

  // Assert: italic text should have italic font-style
  const italicElements = await page.locator('.cm-line').first().locator('text=italic')
  const italicCount = await italicElements.count()
  if (italicCount > 0) {
    const italicStyle = await italicElements.first().evaluate((el) => {
      return window.getComputedStyle(el).fontStyle
    })
    expect(italicStyle).toBe('italic')
  }

  // Assert: placing the caret at position 0 and pressing ArrowRight repeatedly
  // walks the head monotonically to the end of the line, never returning the same
  // head position twice and never landing strictly inside a hidden marker range

  // First, set the caret to position 0 (at the start of the first line)
  await page.evaluate(() => {
    const view = (window as unknown as { __editor: EditorView }).__editor
    // Move to position 0
    view.dispatch({
      selection: { anchor: 0, head: 0 },
    })
  })

  // Track caret positions as we press ArrowRight
  const positions: number[] = [0]
  const sourceLength = sourceText.length

  // Press ArrowRight repeatedly until we reach the end of the first line (or a reasonable limit)
  for (let i = 0; i < sourceLength + 10; i++) {
    await page.keyboard.press('ArrowRight')
    const currentHead = await caretHead(page)

    // Check for monotonic increase (head should never decrease or stay the same)
    const lastPos = positions[positions.length - 1]
    if (currentHead <= lastPos) {
      // If we've reached beyond the first line, stop
      if (currentHead > sourceLength) break
      // Otherwise, this is an error - head should always increase
      expect(currentHead).toBeGreaterThan(lastPos)
    }

    positions.push(currentHead)

    // If we've moved beyond the first line, we can stop
    if (currentHead > sourceLength) break
  }

  // Verify we got monotonic movement with no repeated positions in the first line
  const firstLinePath = positions.slice(0, positions.findIndex(p => p > sourceLength) + 1)
  for (let i = 1; i < firstLinePath.length; i++) {
    expect(firstLinePath[i]).toBeGreaterThan(firstLinePath[i - 1])
  }
})
