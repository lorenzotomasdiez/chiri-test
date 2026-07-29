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
})

test('T-FR-6-2: Selecting text raises the action bar with all three entry points', async ({
  page,
}) => {
  const fullText = 'The report was late because the team was busy.'

  // Type the paragraph into the editor
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullText)

  // Verify the text was typed
  expect(await docText(page)).toBe(fullText)

  // Select "the team was busy" by dispatching a CM6 selection
  // "The report was late because " = 28 chars, so "the team was busy" is at 28-45
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({
      selection: {
        anchor: 28,
        head: 45,
      },
    })
  })

  // Verify the action bar appears
  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  await expect(actionBar).toBeVisible()

  // Verify the "Ask AI" affordance is present
  await expect(page.locator('[data-testid="action-ask-ai"]')).toBeVisible()

  // Verify the four one-tap actions are present
  await expect(page.locator('[data-testid="action-improve-writing"]')).toBeVisible()
  await expect(page.locator('[data-testid="action-make-shorter"]')).toBeVisible()
  await expect(page.locator('[data-testid="action-change-tone"]')).toBeVisible()
  await expect(page.locator('[data-testid="action-fix-grammar"]')).toBeVisible()

  // Verify the free-text instruction field is present
  await expect(page.locator('[data-testid="action-custom-instruction"]')).toBeVisible()

  // Verify the action bar bounding box does not overlap the selection's rectangles
  const actionBarBox = await actionBar.boundingBox()
  const selectionRects = await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const start = editor.state.selection.main.from
    const end = editor.state.selection.main.to
    const startCoords = editor.coordsAtPos(start)
    const endCoords = editor.coordsAtPos(end)
    return { startCoords, endCoords }
  })

  expect(actionBarBox).toBeTruthy()
  expect(selectionRects.startCoords).toBeTruthy()
  expect(selectionRects.endCoords).toBeTruthy()

  // Ensure action bar does not overlap the selection start position
  if (actionBarBox && selectionRects.startCoords) {
    const selectionTop = selectionRects.startCoords.top
    const selectionBottom = selectionRects.endCoords?.bottom || selectionRects.startCoords.bottom
    const barTop = actionBarBox.y
    const barBottom = actionBarBox.y + actionBarBox.height

    // Bar should either be above or below the selection, not overlapping
    const isAbove = barBottom < selectionTop
    const isBelow = barTop > selectionBottom
    expect(isAbove || isBelow).toBeTruthy()
  }
})

test('Jumping from one selection straight to another clears the typed instruction and message', async ({
  page,
}) => {
  const fullText = 'The report was late because the team was busy today.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(fullText)
  expect(await docText(page)).toBe(fullText)

  // Select "the team" (28-36)
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 28, head: 36 } })
  })

  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  const instructionField = page.locator('[data-testid="action-custom-instruction"]')
  await expect(actionBar).toBeVisible()
  await instructionField.fill('Make this punchier')
  await expect(instructionField).toHaveValue('Make this punchier')

  // Jump straight to a different, non-empty selection - "busy today" (41-51) -
  // without ever passing through an empty selection in between.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 41, head: 51 } })
  })

  await expect(actionBar).toBeVisible()
  await expect(instructionField).toHaveValue('')
})
