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

test('T-FR-6-13: Clearing the selection cancels an in-flight revision request', async ({
  page,
}) => {
  const fullText = 'The report was late because the team was busy.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(fullText)
  expect(await docText(page)).toBe(fullText)

  // "the team was busy" is at 28-45
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 28, head: 45 } })
  })

  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  await expect(actionBar).toBeVisible()

  // A revision response held open, standing in for a request still in flight.
  let released = false
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = () => {
      released = true
      resolve()
    }
  })

  await page.route('https://openrouter.ai/**', async (route) => {
    await held
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'reason: Improved\n' } }] })}\n\n` +
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: '--sep--\nthe crew was occupied' } }] })}\n\n` +
        'data: [DONE]\n\n',
    })
  })

  // The user asks for a revision, then clears the selection before it resolves.
  await page.locator('[data-testid="action-ask-ai"]').click()
  await expect(page.locator('[data-testid="action-progress"]')).toBeVisible()

  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 45, head: 45 } })
  })
  await expect(actionBar).toBeHidden()

  // The held response now completes, well after the bar it belonged to unmounted.
  release()
  expect(released).toBe(true)

  // No revision proposal is dispatched for a selection the user already left,
  // and no failure banner appears either - the request was cancelled, not lost.
  await page.waitForTimeout(200)
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  expect(await docText(page)).toBe(fullText)
})
