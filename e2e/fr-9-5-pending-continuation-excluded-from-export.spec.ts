import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { seedValidatedKey } from './seed'
import { docText, ghostText, mockOpenRouter, waitForGhost } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-9-5: A pending continuation is excluded from both export paths', async ({
  page,
  context,
}) => {
  const initialDoc = 'The weather today is'
  const continuation = ' unusually warm for this time of year.'

  await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)

  await waitForGhost(page)

  // The offer is genuinely on screen, not just silently absent.
  expect(await ghostText(page)).toBe(continuation)
  await expect(page.locator('[data-testid="ghost-text"]')).toBeVisible()
  expect(await docText(page)).toBe(initialDoc)

  // Copy path: the ghost text must not leak onto the clipboard.
  const copyButton = page.locator('[data-testid="copy-button"]')
  await copyButton.click()
  const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardContent).toBe(initialDoc)
  expect(clipboardContent).not.toContain('unusually warm')

  // The ghost text is still showing, unaccepted and untouched by the copy.
  expect(await ghostText(page)).toBe(continuation)
  expect(await docText(page)).toBe(initialDoc)

  // Download path: same exclusion, through the separate Blob-to-file code path.
  const downloadPromise = context.waitForEvent('download')
  await page.locator('[data-testid="download-button"]').click()
  const download = await downloadPromise

  const downloadPath = path.join(os.tmpdir(), `fr-9-5-export-${process.pid}-${Math.random()}.md`)
  await download.saveAs(downloadPath)
  const exported = fs.readFileSync(downloadPath, 'utf8')
  fs.unlinkSync(downloadPath)

  expect(exported).toBe(initialDoc)
  expect(exported).not.toContain('unusually warm')

  // The pending continuation is still showing, unaccepted, after both exports.
  await expect(page.locator('[data-testid="ghost-text"]')).toBeVisible()
  expect(await docText(page)).toBe(initialDoc)
})
