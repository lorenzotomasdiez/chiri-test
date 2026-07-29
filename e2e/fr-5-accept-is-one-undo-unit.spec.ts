import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { docText, ghostText, mockOpenRouter, snapshot, waitForGhost } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-14: Accepting a continuation commits it as one undo unit', async ({ page }) => {
  const initialDoc = '- Pack the tent, the stove, and'
  const continuation = ' the pot for coffee.'

  await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)

  await waitForGhost(page)
  expect(await ghostText(page)).toBe(continuation)

  await page.keyboard.press('Tab')
  expect(await docText(page)).toBe(initialDoc + continuation)

  // One undo, not four - an accepted continuation is a single decision the
  // writer made, so it is a single thing to take back. Ctrl-z is bound
  // verbatim in Editor.tsx so this is the same keystroke on every platform.
  await page.keyboard.press('Control+Z')

  const state = await snapshot(page)
  expect(state.doc, 'one undo should remove the whole accepted continuation').toBe(initialDoc)
  expect(state.doc).not.toContain('pot')
  expect(state.doc).not.toContain('coffee')
  expect(state.caret).toBe(initialDoc.length)
})
