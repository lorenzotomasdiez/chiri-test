import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { seedValidatedKey } from './seed'
import { docText, ghostText, mockOpenRouter, waitForGhost } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-10: An unaccepted continuation leaves no trace after export', async ({
  page,
  context,
}) => {
  const initialDoc = 'The cabin sat quiet under the first snow of the season, and'
  const continuation = ' the road out had already vanished.'

  await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)

  await waitForGhost(page)

  // The offer is genuinely on screen - without this the rest of the test
  // would pass just as happily against a feature that never showed anything.
  expect(await ghostText(page)).toBe(continuation)
  await expect(page.locator('[data-testid="ghost-text"]')).toBeVisible()

  // It was never document content in the first place. This is the guarantee
  // export inherits, rather than something export has to strip.
  expect(await docText(page)).toBe(initialDoc)

  const downloadPromise = context.waitForEvent('download')
  await page.locator('[data-testid="download-button"]').click()
  const download = await downloadPromise

  const downloadPath = path.join(os.tmpdir(), `fr-5-export-${process.pid}-${Math.random()}.md`)
  await download.saveAs(downloadPath)
  const exported = fs.readFileSync(downloadPath, 'utf8')
  fs.unlinkSync(downloadPath)

  expect(exported).toBe(initialDoc)
  expect(exported).not.toContain('the road out')
  expect(exported).not.toContain('vanished')
})
