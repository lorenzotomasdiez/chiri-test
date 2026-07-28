import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Get the current caret (selection head) position. */
async function getSelectionHead(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.selection.main.head,
  )
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-3-1: Every supported Markdown construct renders as structured text as it is typed', async ({
  page,
}) => {
  await page.locator('.cm-content').click()

  // Case: Heading '# Title' renders heading-styled with visible 'Title' and hidden '#' marker
  await page.keyboard.type('# Title')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('# Title')
  expect(await page.locator('.cm-line').first().textContent()).toContain('Title')

  // Clear for next test
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Plain text 'Just a sentence.' renders without marker artifacts
  await page.keyboard.type('Just a sentence.')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('Just a sentence.')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Bold '**strong**' renders word in bold weight with markers hidden
  await page.keyboard.type('**strong**')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('**strong**')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Italic '*emphasis*' renders in italic with markers hidden
  await page.keyboard.type('*emphasis*')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('*emphasis*')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Unordered list renders bulleted lines
  await page.keyboard.type('- one')
  await page.keyboard.press('Enter')
  await page.keyboard.type('- two')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('- one\n- two')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Ordered list renders numbered lines
  await page.keyboard.type('1. one')
  await page.keyboard.press('Enter')
  await page.keyboard.type('2. two')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('1. one\n2. two')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Link '[Chiri](https://example.com)' renders visible text as link with syntax hidden
  await page.keyboard.type('[Chiri](https://example.com)')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('[Chiri](https://example.com)')
  expect(await page.locator('.cm-line').first().textContent()).toContain('Chiri')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Code span '`code`' renders in monospace
  await page.keyboard.type('`code`')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('`code`')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Code fence renders block with fence markers visible
  await page.keyboard.type('```')
  await page.keyboard.press('Enter')
  await page.keyboard.type('code line')
  await page.keyboard.press('Enter')
  await page.keyboard.type('```')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('```\ncode line\n```')
  expect(await page.locator('.cm-line').first().textContent()).toContain('```')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Blockquote renders indented with marker still visible
  await page.keyboard.type('> quoted text')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('> quoted text')
  expect(await page.locator('.cm-line').first().textContent()).toContain('>')

  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  // Case: Horizontal rule renders with syntax visible
  await page.keyboard.type('---')
  await page.keyboard.press('ArrowDown')
  expect(await docText(page)).toBe('---')
  expect(await page.locator('.cm-line').first().textContent()).toContain('---')

  // Atomic ranges test: caret skips heading marker on ArrowRight
  // This verifies that T-FR-3-1 atomicRanges regression is fixed (probe 4)
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')

  await page.keyboard.type('# Title')

  // Set caret to position 0
  await page.evaluate(
    () => {
      const view = (window as unknown as { __editor: EditorView }).__editor
      view.dispatch({ selection: { anchor: 0, head: 0 } })
    },
  )

  // Verify start position is 0
  expect(await getSelectionHead(page)).toBe(0)

  // ArrowRight should skip '# ' marker (positions 0-2) and move to position 2
  await page.keyboard.press('ArrowRight')
  expect(await getSelectionHead(page)).toBe(2)

  // Next ArrowRight moves to position 3 (the 'T')
  await page.keyboard.press('ArrowRight')
  expect(await getSelectionHead(page)).toBe(3)

  // Next ArrowRight moves to position 4 (the 'i')
  await page.keyboard.press('ArrowRight')
  expect(await getSelectionHead(page)).toBe(4)
})
