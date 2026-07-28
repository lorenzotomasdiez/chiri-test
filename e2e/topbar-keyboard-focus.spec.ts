import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-CC-NAV-11: every top bar control is keyboard reachable with visible focus ring, wordmark is not (CC-NAV.11, CC-BRAND.4, GAP.3)', async ({
  page,
}) => {
  // Collect accessible names and check focus visibility for each focused element
  const collectedNames: string[] = []
  const focusIndicatorChecks: { name: string; visible: boolean }[] = []

  // Tab from address bar into the page - first focus should land on Predictions toggle
  await page.keyboard.press('Tab')

  // Collect focusable elements from top bar by pressing Tab and recording names
  // We expect exactly 4: Predictions, GPT-4o mini, Copy, Download .md
  for (let i = 0; i < 4; i++) {
    // Get the currently focused element's accessible name
    const focusedElement = await page.evaluateHandle(() => document.activeElement)
    const accessibleName = await page.evaluate((el) => {
      if (!el) return ''
      return (
        (el as HTMLElement).getAttribute('aria-label') ||
        (el as HTMLElement).textContent ||
        (el as HTMLElement).innerText ||
        ''
      )
    }, focusedElement)

    const cleanedName = (accessibleName as string).trim()
    collectedNames.push(cleanedName)

    // Check if the focused element has a visible focus indicator
    const hasVisibleFocus = await page.evaluate((el) => {
      if (!el) return false
      const styles = window.getComputedStyle(el as Element)
      const outlineStyle = styles.outlineStyle
      const outlineWidth = styles.outlineWidth
      const boxShadow = styles.boxShadow

      const hasOutline =
        outlineStyle !== 'none' &&
        outlineWidth !== '0px' &&
        outlineWidth !== 'medium' &&
        parseInt(outlineWidth) > 0

      const hasBoxShadow = boxShadow !== 'none' && boxShadow !== ''

      return hasOutline || hasBoxShadow
    }, focusedElement)

    focusIndicatorChecks.push({
      name: cleanedName,
      visible: hasVisibleFocus,
    })

    // Move to next element
    if (i < 3) {
      await page.keyboard.press('Tab')
    }
  }

  // Verify the accessible names match exactly
  expect(collectedNames).toEqual(['Predictions', 'GPT-4o mini', 'Copy', 'Download .md'])

  // Verify each has a visible focus indicator
  for (const check of focusIndicatorChecks) {
    expect(check.visible).toBe(
      true,
      `Element "${check.name}" did not have a visible focus indicator`,
    )
  }

  // Verify the wordmark is not reachable by Tab and has no interactive attributes
  const wordmark = await page.locator('text=Chiri').first()
  const isVisible = await wordmark.isVisible()
  expect(isVisible).toBe(true)

  const tagName = await wordmark.evaluate((el) => (el as HTMLElement).tagName)
  expect(['A', 'BUTTON']).not.toContain(tagName)

  const hasTabindex = await wordmark.evaluate((el) =>
    (el as HTMLElement).hasAttribute('tabindex'),
  )
  expect(hasTabindex).toBe(false)
})
