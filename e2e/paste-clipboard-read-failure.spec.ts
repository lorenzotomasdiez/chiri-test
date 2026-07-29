import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)

  // Override navigator.clipboard.readText to reject, simulating a denied
  // read permission or a focus-loss race.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: () => Promise.reject(new Error('denied')),
      },
      configurable: true,
    })
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('Ctrl-v paste with a rejecting clipboard read is an inert no-op, not an unhandled rejection', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.locator('.cm-content').click()
  await page.keyboard.type('# Before paste')

  await page.keyboard.press('Control+v')

  // The rejected read resolves asynchronously; give it a turn to settle.
  await page.waitForTimeout(200)

  const docText = await page.evaluate(
    () => (window as unknown as { __editor: { state: { doc: { toString(): string } } } }).__editor.state.doc.toString(),
  )
  expect(docText).toBe('# Before paste')
  expect(pageErrors).toEqual([])
})
