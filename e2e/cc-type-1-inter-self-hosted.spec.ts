import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
})

test('T-CC-TYPE-1-2: Inter is a real, loadable font face, not just a declared name (CC-TYPE.1, CC-ALL.7)', async ({
  page,
}) => {
  // CC-TYPE.1 requires the whole interface and document to render in Inter,
  // and CC-ALL.7 requires that to hold with the network disabled. Asserting
  // getComputedStyle().fontFamily only proves the CSS *says* "Inter" - a
  // browser falls back silently to the OS default when the name is declared
  // but no matching @font-face was ever registered. document.fonts.load()
  // is the check that distinguishes "declared" from "actually renderable":
  // it resolves to zero FontFace matches when there is no @font-face rule
  // for that family, regardless of what font-family strings claim.
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('16px Inter')
    return faces.map((f) => ({ family: f.family, status: f.status }))
  })

  expect(loaded.length).toBeGreaterThan(0)
  for (const face of loaded) {
    expect(face.status).toBe('loaded')
  }

  const bodyFont = await page.evaluate(() =>
    window.getComputedStyle(document.body).fontFamily,
  )
  expect(bodyFont).toContain('Inter')
})
