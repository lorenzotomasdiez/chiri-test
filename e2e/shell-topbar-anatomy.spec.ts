import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
})

test('T-CC-NAV-1: Top bar anatomy, control order, and labels (CC-BRAND.1, CC-BRAND.2, CC-BRAND.4, CC-NAV.4, CC-NAV.5, CC-NAV.7, CC-NAV.8, CC-ICON.2)', async ({
  page,
}) => {
  // Assert single banner landmark exists
  const banners = page.locator('banner')
  await expect(banners).toHaveCount(1)
  const banner = banners.first()

  // Assert bounding box and positioning
  const box = await banner.boundingBox()
  expect(box?.height).toBe(48)

  const computedStyle = await banner.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return {
      position: styles.position,
      top: styles.top,
      left: styles.left,
      width: styles.width,
      paddingLeft: styles.paddingLeft,
      paddingRight: styles.paddingRight,
      backgroundColor: styles.backgroundColor,
      borderBottom: styles.borderBottom,
    }
  })

  expect(computedStyle.position).toBe('fixed')
  expect(computedStyle.top).toBe('0px')
  expect(computedStyle.left).toBe('0px')
  expect(computedStyle.width).toBe('1280px')
  expect(computedStyle.paddingLeft).toBe('24px')
  expect(computedStyle.paddingRight).toBe('24px')
  expect(computedStyle.backgroundColor).toBe('rgb(253, 248, 248)')

  // Assert bottom border is 1px in hairline colour
  // hairline colour is #C7C6CA = rgb(199, 198, 202)
  expect(computedStyle.borderBottom).toContain('1px')
  expect(computedStyle.borderBottom).toContain('rgb(199, 198, 202)')

  // Assert wordmark - plain text "Chiri" at far left
  const wordmark = banner.locator('text=Chiri').first()
  await expect(wordmark).toBeVisible()

  // Assert wordmark is plain text, not a button or link
  const wordmarkElement = await wordmark.evaluate((el) => {
    return {
      tagName: el.tagName.toLowerCase(),
      hasHref: el.hasAttribute('href'),
      hasRole: el.hasAttribute('role'),
      fontSize: window.getComputedStyle(el).fontSize,
      fontWeight: window.getComputedStyle(el).fontWeight,
      letterSpacing: window.getComputedStyle(el).letterSpacing,
      color: window.getComputedStyle(el).color,
    }
  })

  expect(wordmarkElement.tagName).not.toBe('a')
  expect(wordmarkElement.tagName).not.toBe('button')
  expect(wordmarkElement.hasHref).toBe(false)
  expect(wordmarkElement.hasRole).toBe(false)
  expect(wordmarkElement.fontSize).toBe('18px')
  expect(wordmarkElement.fontWeight).toBe('600')
  expect(wordmarkElement.letterSpacing).not.toBe('0px')
  expect(wordmarkElement.color).toBe('rgb(29, 29, 31)')

  // Assert no img or svg next to wordmark
  const wordmarkParent = await wordmark.evaluate((el) => el.parentElement)
  const siblingSvgs = await banner.locator('svg').count()
  const siblingImgs = await banner.locator('img').count()
  expect(siblingSvgs).toBe(0)
  expect(siblingImgs).toBe(0)

  // Assert centre is empty - no title, breadcrumb, or menu items between wordmark and right cluster
  // We'll check that interactive controls are only on the right

  // Assert right cluster controls have accessible names in exact order
  const controls = banner.locator('button')
  const controlNames: string[] = []

  for (let i = 0; i < (await controls.count()); i++) {
    const control = controls.nth(i)
    const name = await control.evaluate((el) => {
      // Get accessible name from aria-label, aria-labelledby, or text content
      const ariaLabel = el.getAttribute('aria-label')
      if (ariaLabel) return ariaLabel
      return el.textContent?.trim() || ''
    })
    if (name) {
      controlNames.push(name)
    }
  }

  expect(controlNames).toEqual(['Predictions', 'GPT-4o mini', 'Copy', 'Download .md'])

  // Assert divider element exists between GPT-4o mini and Copy button
  const dividers = banner.locator('[role="separator"], .divider, [aria-orientation="vertical"]')
  const dividerCount = await dividers.count()
  expect(dividerCount).toBeGreaterThanOrEqual(1)

  // Assert divider styling
  const divider = dividers.first()
  const dividerStyle = await divider.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return {
      width: styles.width,
      borderLeft: styles.borderLeft,
    }
  })

  // Divider should be 1px wide with hairline colour
  expect(dividerStyle.width).toBe('1px')
  expect(dividerStyle.borderLeft).toContain('rgb(199, 198, 202)')

  // Assert Copy and Download buttons have icons and text labels
  const copyButton = controls.filter({ hasText: 'Copy' }).first()
  const downloadButton = controls.filter({ hasText: 'Download .md' }).first()

  const copyHasIcon = await copyButton.locator('svg, [class*="icon"]').count()
  expect(copyHasIcon).toBeGreaterThan(0)
  expect(await copyButton.textContent()).toContain('Copy')

  const downloadHasIcon = await downloadButton.locator('svg, [class*="icon"]').count()
  expect(downloadHasIcon).toBeGreaterThan(0)
  expect(await downloadButton.textContent()).toContain('Download .md')
})
