import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { seedValidatedKey } from './seed'
import { mockRevisionResponse } from './openrouter-mock'
import type { EditorView } from '@codemirror/view'

async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

async function readClipboard(page: import('@playwright/test').Page) {
  return page.evaluate(() => navigator.clipboard.readText())
}

async function downloadedContent(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  const downloadPromise = context.waitForEvent('download')
  await page.getByRole('button', { name: 'Download .md' }).click()
  const download = await downloadPromise
  const downloadPath = path.join(os.tmpdir(), `fr-9-6-export-${process.pid}-${Math.random()}.md`)
  await download.saveAs(downloadPath)
  const content = fs.readFileSync(downloadPath, 'utf8')
  fs.unlinkSync(downloadPath)
  return content
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-9-6: A pending revision, in either state, is excluded from both export paths', async ({
  page,
  context,
}) => {
  const fullDoc =
    'Intro line.\n\nThe quarterly numbers were, on the whole, somewhat disappointing to the extended leadership team.\n\nClosing line.'
  const originalSentence =
    'The quarterly numbers were, on the whole, somewhat disappointing to the extended leadership team.'
  const initialProposal = 'Quarterly numbers disappointed leadership.'
  const refinedProposal = 'Numbers disappointed leadership.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)
  expect(await docText(page)).toBe(fullDoc)

  const startIdx = fullDoc.indexOf(originalSentence)
  const endIdx = startIdx + originalSentence.length
  await page.evaluate(({ start, end }) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: start, head: end } })
  }, { start: startIdx, end: endIdx })

  await mockRevisionResponse(page, { reason: 'Shortened for concision', proposal: initialProposal })
  await page.locator('button:has-text("Improve the writing")').click()
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })
  await expect(page.locator('[data-testid="revision-proposed"]')).toContainText(initialProposal)

  // Export while the first proposal is pending: neither path may leak the proposed text.
  expect(await readClipboard(page)).toBe('')
  await page.getByRole('button', { name: 'Copy' }).click()
  expect(await readClipboard(page)).toBe(fullDoc)
  expect(await readClipboard(page)).not.toContain(initialProposal)

  const firstDownload = await downloadedContent(page, context)
  expect(firstDownload).toBe(fullDoc)
  expect(firstDownload).not.toContain(initialProposal)

  // Refine, so a second proposed version is showing over the same span.
  await page.locator('[data-testid="revision-decoration"] button:has-text("Refine")').click()
  await page.waitForSelector('[data-testid="refinement-instruction-input"]', { timeout: 5000 })
  await page.locator('[data-testid="refinement-instruction-input"]').fill('make it even shorter')
  await mockRevisionResponse(page, { reason: 'Trimmed further', proposal: refinedProposal })

  const submitButton = page.locator('[data-testid="revision-decoration"] button:has-text("Submit")')
  if (await submitButton.isVisible()) {
    await submitButton.click()
  } else {
    await page.locator('[data-testid="refinement-instruction-input"]').press('Enter')
  }
  await expect(page.locator('[data-testid="revision-proposed"]')).toContainText(refinedProposal)

  // Export again with the refined proposal pending: still only the original text.
  await page.getByRole('button', { name: 'Copy' }).click()
  const clipboardAfterRefine = await readClipboard(page)
  expect(clipboardAfterRefine).toBe(fullDoc)
  expect(clipboardAfterRefine).not.toContain(initialProposal)
  expect(clipboardAfterRefine).not.toContain(refinedProposal)

  const secondDownload = await downloadedContent(page, context)
  expect(secondDownload).toBe(fullDoc)
  expect(secondDownload).not.toContain(initialProposal)
  expect(secondDownload).not.toContain(refinedProposal)

  // The pending revision itself is untouched by either export - still on screen, unaccepted.
  await expect(page.locator('[data-testid="revision-decoration"]')).toBeVisible()
  expect(await docText(page)).toBe(fullDoc)
})
