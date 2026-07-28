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

test('T-CC-DOC-3: document surface typography is Inter 18px antialiased with ink text, caret, and transparent focus (CC-TYPE, CC-DOC, CC-SHELL)', async ({
  page,
}) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type('The shift to remote work was supposed to liberate our schedules.')

  // Verify the text was entered
  expect(await docText(page)).toBe('The shift to remote work was supposed to liberate our schedules.')

  // CC-TYPE.1: .cm-content font-family starts with Inter, no serif
  const fontFamily = await page.locator('.cm-content').evaluate((el) => {
    return window.getComputedStyle(el).fontFamily
  })
  expect(fontFamily).toMatch(/^Inter/)
  expect(fontFamily).not.toContain('serif')

  // CC-TYPE.1: font-size 18px
  const fontSize = await page.locator('.cm-content').evaluate((el) => {
    return window.getComputedStyle(el).fontSize
  })
  expect(fontSize).toBe('18px')

  // CC-TYPE.6: -webkit-font-smoothing antialiased
  const fontSmoothing = await page.locator('.cm-content').evaluate((el) => {
    return window.getComputedStyle(el).WebkitFontSmoothing
  })
  // -webkit-font-smoothing is non-standard: Blink and WebKit report the
  // declared 'antialiased', Gecko normalises the same declaration to
  // 'grayscale'. Both are the smoothed rendering CC-TYPE.6 asks for, so the
  // assertion accepts either rather than failing Firefox for a vendor quirk.
  expect(['antialiased', 'grayscale']).toContain(fontSmoothing)

  // CC-DOC.3: .cm-line line-height 31.5px (1.75 * 18px)
  const lineHeight = await page.locator('.cm-line').first().evaluate((el) => {
    return window.getComputedStyle(el).lineHeight
  })
  expect(lineHeight).toBe('31.5px')

  // CC-DOC.3: .cm-line color is ink rgb(29, 29, 31)
  const textColor = await page.locator('.cm-line').first().evaluate((el) => {
    return window.getComputedStyle(el).color
  })
  expect(textColor).toBe('rgb(29, 29, 31)')

  // CC-DOC.2: .cm-editor.cm-focused outline-style none or outline-width 0px
  const focused = page.locator('.cm-editor.cm-focused')
  const outlineStyle = await focused.evaluate((el) => {
    return window.getComputedStyle(el).outlineStyle
  })
  const outlineWidth = await focused.evaluate((el) => {
    return window.getComputedStyle(el).outlineWidth
  })
  expect(outlineStyle === 'none' || outlineWidth === '0px').toBe(true)

  // CC-DOC.2: border-width 0px
  const borderWidth = await focused.evaluate((el) => {
    return window.getComputedStyle(el).borderWidth
  })
  expect(borderWidth).toBe('0px')

  // CC-DOC.2: box-shadow none
  const boxShadow = await focused.evaluate((el) => {
    return window.getComputedStyle(el).boxShadow
  })
  expect(boxShadow).toBe('none')

  // CC-DOC.2: background-color transparent or paper rgb(253, 248, 248)
  const bgColor = await focused.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor
  })
  expect(['transparent', 'rgba(0, 0, 0, 0)', 'rgb(253, 248, 248)'].some(color => color === bgColor)).toBe(
    true,
  )

  // CC-DOC.2: caret-color ink rgb(29, 29, 31), not scaffold #08060d
  const caretColor = await focused.evaluate((el) => {
    return window.getComputedStyle(el).caretColor
  })
  expect(caretColor).toBe('rgb(29, 29, 31)')

  // CC-SHELL.3: document.body background-color paper rgb(253, 248, 248)
  const bodyBg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor
  })
  expect(bodyBg).toBe('rgb(253, 248, 248)')
})
