import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { docText, ghostText, mockOpenRouter, snapshot, waitForGhost } from './continuation'

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-5: Repeated accept-word presses consume the continuation one word at a time', async ({
  page,
}) => {
  const initialDoc = '- Pack the tent, the stove, and'
  const continuation = ' the pot for coffee.'

  await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)
  expect(await docText(page)).toBe(initialDoc)

  await waitForGhost(page)
  expect(await ghostText(page)).toBe(continuation)

  // Each press commits exactly one more word - leading space included, since
  // that space is what keeps the document reading correctly - and leaves the
  // rest still on offer.
  const steps = [
    { doc: `${initialDoc} the`, ghost: ' pot for coffee.' },
    { doc: `${initialDoc} the pot`, ghost: ' for coffee.' },
    { doc: `${initialDoc} the pot for`, ghost: ' coffee.' },
    { doc: `${initialDoc} the pot for coffee.`, ghost: null },
  ]

  for (const [index, step] of steps.entries()) {
    await page.keyboard.press(`${MOD}+ArrowRight`)

    // Read in one round trip. After the fourth press the caret sits at an
    // eligible position again, so the scheduler will offer a fresh
    // continuation once its settle window elapses - the assertion has to
    // land inside that window, and four sequential reads might not.
    const state = await snapshot(page)

    expect(state.doc, `document after press ${index + 1}`).toBe(step.doc)
    expect(state.ghost, `ghost after press ${index + 1}`).toBe(step.ghost)
    expect(state.caret, `caret after press ${index + 1}`).toBe(step.doc.length)
  }

  // The fourth press exhausted the offer: nothing is left painted.
  expect((await snapshot(page)).ghostWidgets).toBe(0)
})
