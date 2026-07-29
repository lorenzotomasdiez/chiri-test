import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-CC-MODEL-5: Model dropdown panel anatomy and selection (CC-MODEL.1, CC-MODEL.2, CC-MODEL.5, CC-MODEL.6, CC-MODEL.7, CC-MODEL.9, CC-PANEL.1, CUT.5)', async ({
  page,
}) => {
  // CC-MODEL.1, CC-MODEL.2: Verify initial trigger state - shows model name in full ink, no slug, with expand_more caret
  const trigger = page.locator('[data-testid="model-selector-trigger"]')
  // The caret is a drawn glyph, not text: its name must never be readable on
  // screen. So the trigger's text is the model name alone, and the caret is
  // asserted as an element pointing at the expand_more sprite symbol.
  await expect(trigger).toHaveText(/^GPT-4o mini$/)
  await expect(trigger.locator('svg use[href$="#expand_more"]')).toHaveCount(1)

  // Verify trigger text color is full ink rgb(29, 29, 31)
  const triggerComputedColor = await trigger.evaluate((el) =>
    window.getComputedStyle(el).color,
  )
  expect(triggerComputedColor).toBe('rgb(29, 29, 31)')

  // CC-MODEL.1: Verify no panel in DOM initially
  await expect(page.locator('[data-testid="model-selector-panel"]')).toHaveCount(0)

  // User clicks the trigger
  await trigger.click()

  // CC-MODEL.5, CC-PANEL.1: Verify panel appears with correct size and position
  const panel = page.locator('[data-testid="model-selector-panel"]')
  await expect(panel).toBeVisible()

  const panelBox = await panel.boundingBox()
  expect(panelBox).not.toBeNull()

  // Width is 288px
  expect(panelBox!.width).toBe(288)

  // Top edge at y=48
  expect(panelBox!.y).toBe(48)

  // Right edge aligned to the trigger's right edge, not to the viewport
  // gutter: with CC-NAV.7's full "Copy" and "Download .md" labels the trigger
  // no longer sits near the gutter, and a gutter-anchored panel would open
  // ~240px away from the control that raised it (CC-MODEL.5 as amended).
  const triggerBox = await trigger.boundingBox()
  expect(Math.round(panelBox!.x + panelBox!.width)).toBe(Math.round(triggerBox!.x + triggerBox!.width))
  // ...and never overhangs the 24px gutter.
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(1280 - 24)

  // Verify styling: white background and border-radius
  const panelBgColor = await panel.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor,
  )
  expect(panelBgColor).toBe('rgb(255, 255, 255)')

  const panelBorderRadius = await panel.evaluate((el) =>
    window.getComputedStyle(el).borderRadius,
  )
  expect(panelBorderRadius).toBe('8px')

  // Verify 1px hairline border
  const panelBorderWidth = await panel.evaluate((el) =>
    window.getComputedStyle(el).borderWidth,
  )
  expect(panelBorderWidth).toBe('1px')

  const panelBorderColor = await panel.evaluate((el) =>
    window.getComputedStyle(el).borderColor,
  )
  expect(panelBorderColor).toBe('rgb(199, 198, 202)') // hairline color #C7C6CA

  // CC-MODEL.11: Verify panel does not scroll
  const scrollHeight = await panel.evaluate((el) => el.scrollHeight)
  const clientHeight = await panel.evaluate((el) => el.clientHeight)
  expect(scrollHeight).toBe(clientHeight)

  // CC-MODEL.6, CC-MODEL.7, CUT.5: Verify row content and structure
  const rows = panel.locator('[data-testid="model-row"]')
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThanOrEqual(3)
  expect(rowCount).toBeLessThanOrEqual(5)

  // First row: GPT-4o mini / fast, low cost
  const row1 = rows.nth(0)
  const row1Title = row1.locator('[data-testid="model-row-title"]')
  const row1Note = row1.locator('[data-testid="model-row-note"]')

  await expect(row1Title).toHaveText('GPT-4o mini')
  await expect(row1Note).toHaveText('fast, low cost')

  // Verify no slug in row 1
  const row1Text = await row1.textContent()
  expect(row1Text).not.toMatch(/openai\//)

  // Verify capability note font size is 10px
  const noteComputedSize = await row1Note.evaluate((el) =>
    window.getComputedStyle(el).fontSize,
  )
  expect(noteComputedSize).toBe('10px')

  // Second row: GPT-4o / stronger reasoning, slower
  const row2 = rows.nth(1)
  const row2Title = row2.locator('[data-testid="model-row-title"]')
  const row2Note = row2.locator('[data-testid="model-row-note"]')

  await expect(row2Title).toHaveText('GPT-4o')
  await expect(row2Note).toHaveText('stronger reasoning, slower')
  const row2Text = await row2.textContent()
  expect(row2Text).not.toMatch(/openai\//)

  // Third row: GPT-4.1 / large context
  const row3 = rows.nth(2)
  const row3Title = row3.locator('[data-testid="model-row-title"]')
  const row3Note = row3.locator('[data-testid="model-row-note"]')

  await expect(row3Title).toHaveText('GPT-4.1')
  await expect(row3Note).toHaveText('large context')
  const row3Text = await row3.textContent()
  expect(row3Text).not.toMatch(/openai\//)

  // CC-MODEL.9: Verify GPT-4o mini row is selected with check icon and container fill
  await expect(row1).toHaveAttribute('aria-selected', 'true')

  const row1BgColor = await row1.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor,
  )
  expect(row1BgColor).toBe('rgb(241, 237, 236)') // container fill color #F1EDEC

  const checkIcon = row1.locator('[data-testid="check-icon"]')
  await expect(checkIcon).toBeVisible()

  // Verify other rows are not selected
  await expect(row2).toHaveAttribute('aria-selected', 'false')
  await expect(row3).toHaveAttribute('aria-selected', 'false')

  // User clicks the GPT-4o row
  await row2.click()

  // CC-MODEL.9: Verify panel is removed from DOM
  await expect(panel).toHaveCount(0)

  // Verify trigger text becomes exactly 'GPT-4o'
  await expect(trigger).toHaveText(/^GPT-4o$/)
  await expect(trigger.locator('svg use[href$="#expand_more"]')).toHaveCount(1)

  // Reopen the panel
  await trigger.click()
  const panelReopened = page.locator('[data-testid="model-selector-panel"]')
  await expect(panelReopened).toBeVisible()

  // Verify check icon is now on GPT-4o row
  const rowsReopened = panelReopened.locator('[data-testid="model-row"]')
  const row1Reopened = rowsReopened.nth(0)
  const row2Reopened = rowsReopened.nth(1)

  await expect(row1Reopened).toHaveAttribute('aria-selected', 'false')
  await expect(row2Reopened).toHaveAttribute('aria-selected', 'true')

  const row2BgColor = await row2Reopened.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor,
  )
  expect(row2BgColor).toBe('rgb(241, 237, 236)')

  const checkIconRow2 = row2Reopened.locator('[data-testid="check-icon"]')
  await expect(checkIconRow2).toBeVisible()

  const checkIconRow1 = row1Reopened.locator('[data-testid="check-icon"]')
  await expect(checkIconRow1).toHaveCount(0)
})

test('T-CC-MODEL-14: Trigger hover affordance (CC-MODEL.3)', async ({ page }) => {
  const trigger = page.locator('[data-testid="model-selector-trigger"]')
  const caret = trigger.locator('svg')

  // At rest: no container fill behind the trigger, and the caret sits at
  // reduced opacity (CC-MODEL.1's "outline color at reduced opacity").
  const restBgColor = await trigger.evaluate((el) => window.getComputedStyle(el).backgroundColor)
  expect(restBgColor).toBe('rgba(0, 0, 0, 0)')
  const restCaretOpacity = await caret.evaluate((el) => window.getComputedStyle(el).opacity)
  expect(Number(restCaretOpacity)).toBeCloseTo(0.7, 1)

  // On hover: a subtle container fill appears behind the trigger and the
  // caret comes to full opacity.
  await trigger.hover()
  await expect(trigger).toHaveCSS('background-color', 'rgb(241, 237, 236)')
  await expect(caret).toHaveCSS('opacity', '1')
})
