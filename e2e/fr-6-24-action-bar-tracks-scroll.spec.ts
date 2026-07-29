import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-6-24: the action bar does not linger over unrelated text after the window scrolls', async ({
  page,
}) => {
  // Enough paragraphs to make the window itself scroll (CC-SHELL.6: the
  // window is the scroll container, not an inner .cm-scroller).
  const paragraph = 'The report was late because the team was busy. '.repeat(6)
  const paragraphs = Array.from({ length: 40 }, () => paragraph).join('\n\n')

  await page.locator('.cm-content').click()
  await page.evaluate((text) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } })
  }, paragraphs)

  // Select a span near the bottom of the document, scrolled into view.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const end = editor.state.doc.length
    editor.dispatch({
      selection: { anchor: end - 40, head: end - 10 },
      scrollIntoView: true,
    })
  })

  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  await expect(actionBar).toBeVisible()

  const boxBeforeScroll = await actionBar.boundingBox()
  expect(boxBeforeScroll).toBeTruthy()

  // Scroll the window itself (the real scroll container per CC-SHELL.6).
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(100)

  const selectionRectsAfterScroll = await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const { from, to } = editor.state.selection.main
    return { start: editor.coordsAtPos(from), end: editor.coordsAtPos(to) }
  })
  expect(selectionRectsAfterScroll.start).toBeTruthy()

  // Either the bar tracked the selection to its new on-screen position, or it
  // is gone. What it must never do is stay put over text that scrolled away
  // from underneath it.
  const barAfterScroll = await actionBar.count()
  if (barAfterScroll > 0) {
    const boxAfterScroll = await actionBar.boundingBox()
    expect(boxAfterScroll).toBeTruthy()
    expect(boxAfterScroll!.y).not.toBeCloseTo(boxBeforeScroll!.y, 0)

    const selectionTop = selectionRectsAfterScroll.start!.top
    const selectionBottom = selectionRectsAfterScroll.end!.bottom
    const barTop = boxAfterScroll!.y
    const barBottom = boxAfterScroll!.y + boxAfterScroll!.height
    const staysNearSelection = barTop <= selectionBottom + 40 && barBottom >= selectionTop - 40
    expect(staysNearSelection).toBe(true)
  }
})
