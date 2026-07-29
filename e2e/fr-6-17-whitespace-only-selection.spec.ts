/**
 * T-FR-6-17: A whitespace-only or zero-width selection raises no bar and
 * issues no request.
 *
 * A collapsed (zero-width) selection was already excluded from raising the
 * action bar, but a non-empty selection covering only whitespace - no
 * visible characters to revise - was not: it has the same from !== to shape
 * as a real text selection, so it slipped through the emptiness check alone.
 */

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-6-17: selecting only a run of spaces raises no action bar', async ({ page }) => {
  const text = 'The report was late    because the team was busy.'
  // "The report was late" = 19 chars, followed by 4 spaces at [19, 23).
  const spacesFrom = 19
  const spacesTo = 23

  await page.locator('.cm-content').click()
  await page.keyboard.type(text)

  await page.evaluate(
    ({ from, to }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      editor.dispatch({ selection: { anchor: from, head: to } })
    },
    { from: spacesFrom, to: spacesTo },
  )

  // The selection is non-empty (from !== to) but covers only whitespace.
  const selectedText = await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const { from, to } = editor.state.selection.main
    return editor.state.doc.sliceString(from, to)
  })
  expect(selectedText).toBe('    ')

  await page.waitForTimeout(150)
  await expect(page.locator('[data-testid="selection-action-bar"]')).toHaveCount(0)
})

test('T-FR-6-17: a zero-width (collapsed) selection still raises no action bar', async ({
  page,
}) => {
  const text = 'The report was late because the team was busy.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(text)

  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 10, head: 10 } })
  })

  await page.waitForTimeout(150)
  await expect(page.locator('[data-testid="selection-action-bar"]')).toHaveCount(0)
})
