import { test, expect, type Page } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/**
 * CC-SHELL.5 and CC-SHELL.6: the document column grows with its content and
 * the window is the only scroll container. A short document must therefore
 * produce no scrollbar at all, and no state of the app may put a second,
 * nested scroller inside the column - a scrollbar that starts and stops
 * mid-page belongs to the editor rather than the page, which is exactly the
 * chrome CC-SHELL.1's two-region shell rules out.
 *
 * These read geometry off the real rendered view rather than asserting on
 * CSS declarations: the bug being pinned here is an emergent one (a fixed
 * host height plus a percentage editor height plus viewport-relative
 * padding), and no single declaration states it.
 */

/** Replaces the document wholesale, the way a restored FR-4 record arrives. */
async function setDoc(page: Page, text: string) {
  await page.evaluate((value) => {
    const view = (window as unknown as { __editor: EditorView }).__editor
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, text)
}

/** True when the page itself has more content than the viewport can show. */
function pageScrolls(page: Page) {
  return page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
}

/** The overflow of CodeMirror's own scroller - any at all means a nested scroller. */
function scrollerOverflow(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.cm-scroller')
    if (!el) throw new Error('.cm-scroller not found')
    return el.scrollHeight - el.clientHeight
  })
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  // Tall window on purpose: the 40vh bottom padding this pins scales with the
  // viewport, so a short window would mask it.
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-CC-SHELL-5-a: a short document produces no scrollbar and no nested scroller', async ({
  page,
}) => {
  await setDoc(page, '# A short note\n\nJust a handful of lines.\n\nNothing more than this.')

  expect(await pageScrolls(page)).toBe(false)

  // The window is the only scroll container: the editor's own scroller must
  // have nothing to scroll.
  expect(await scrollerOverflow(page)).toBeLessThanOrEqual(0)

  // CC-SHELL.5: the column clears the 48px top bar, so the first line is
  // fully visible rather than clipped underneath it.
  const firstLineTop = await page.evaluate(() => {
    const line = document.querySelector('.cm-content .cm-line')
    if (!line) throw new Error('no .cm-line rendered')
    return line.getBoundingClientRect().top
  })
  expect(firstLineTop).toBeGreaterThanOrEqual(48)

  // CC-SHELL.6: never horizontally.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false)
})

test('T-CC-SHELL-5-b: a long document scrolls the window, and only the window', async ({
  page,
}) => {
  const long = Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1} of a long document.`).join(
    '\n\n',
  )
  await setDoc(page, long)

  // The page is the scroller now.
  expect(await pageScrolls(page)).toBe(true)

  // And still the only one - exactly one scrollbar on the screen.
  expect(await scrollerOverflow(page)).toBeLessThanOrEqual(0)

  // CC-SHELL.5: at least 128px of trailing space beneath the last line once
  // scrolled to the bottom, so it never sits against the bottom edge.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const trailing = await page.evaluate(() => {
    const lines = document.querySelectorAll('.cm-content .cm-line')
    const last = lines[lines.length - 1]
    if (!last) throw new Error('no .cm-line rendered')
    return window.innerHeight - last.getBoundingClientRect().bottom
  })
  expect(trailing).toBeGreaterThanOrEqual(128)

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false)
})
