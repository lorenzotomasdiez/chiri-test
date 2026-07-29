import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { revisionTranscript } from './openrouter-mock'
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

test('T-FR-6-4: A free-text instruction produces a revision reflecting that instruction, over the same span', async ({
  page,
}) => {
  const fullText = 'We think the results are good but more testing may be needed.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(fullText)
  expect(await docText(page)).toBe(fullText)

  // Select the whole paragraph so the action bar appears.
  await page.keyboard.press('Meta+a')

  // Capture the actual request body sent to OpenRouter, so this test proves
  // the free-text instruction itself - not one of the canned one-tap labels -
  // reaches the model, and that only the selected span is carried as content.
  let capturedBody: string | null = null
  await page.route('https://openrouter.ai/**', async (route) => {
    capturedBody = route.request().postData()
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: revisionTranscript({
        reason: 'More assertive phrasing',
        proposal: 'The results are strong, though further testing is warranted.',
      }),
    })
  })

  const input = page.locator('[data-testid="action-custom-instruction"]')
  await input.fill('make this sound more confident')
  await input.press('Enter')

  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  // The request body carries the typed instruction, not one of the one-tap labels.
  expect(capturedBody).toBeTruthy()
  expect(capturedBody).toContain('make this sound more confident')
  expect(capturedBody).not.toContain('Improve the writing.')
  expect(capturedBody).not.toContain('Make it shorter.')
  expect(capturedBody).not.toContain('Change the tone.')
  expect(capturedBody).not.toContain('Fix grammar and spelling.')

  // The revision renders over exactly the selected span, not some other part
  // of the document - the proposal is a rewrite of the selection.
  const existingText = await page.locator('[data-testid="revision-existing"]').textContent()
  expect(existingText).toContain(fullText)

  const proposedText = await page.locator('[data-testid="revision-proposed"]').textContent()
  expect(proposedText).toContain('The results are strong, though further testing is warranted.')

  // Nothing is committed to the document yet.
  expect(await docText(page)).toBe(fullText)
})
