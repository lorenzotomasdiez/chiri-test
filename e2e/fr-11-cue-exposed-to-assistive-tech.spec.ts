import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedValidatedKey } from './seed'

/** The keystroke the cue names, per T-FR-11-1's reading of the same copy. */
const ACCEPT_KEY = /\b(Tab|Ctrl\+Enter|Cmd\+Enter)\b/

/**
 * Every string the accessibility tree carries, flattened.
 *
 * Checking `textContent` would only prove the characters are in the DOM, which
 * a `display: none` node or an `aria-hidden` subtree also satisfies. The
 * snapshot is what the platform would hand a screen reader, so it is the only
 * source that can answer "is this exposed" rather than "is this present".
 */
async function accessibilityText(page: Page): Promise<string> {
  return page.locator('body').ariaSnapshot()
}

/**
 * The accessible name and description a screen reader would speak on reaching
 * the editor, resolved through aria-labelledby/aria-describedby the way the
 * platform resolves them.
 */
async function editorAnnouncement(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="editor"] .cm-content')
    if (!el) return ''
    const resolve = (attr: string) =>
      (el.getAttribute(attr) ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
    return [
      el.getAttribute('aria-label') ?? '',
      resolve('aria-labelledby'),
      resolve('aria-describedby'),
      el.getAttribute('title') ?? '',
    ].join(' ')
  })
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test("T-FR-11-9: the cue's instructional text is exposed to assistive technology", async ({
  page,
}) => {
  const cue = page.locator('[data-testid="onboarding-cue"]')
  await expect(cue).toBeVisible()
  const cueText = ((await cue.textContent()) ?? '').trim()
  expect(cueText).toMatch(ACCEPT_KEY)

  // The cue is not hidden from the accessibility tree. A decorative-looking
  // overlay is exactly the kind of element that picks up aria-hidden by
  // reflex, and doing so here would delete the only place a first-time user
  // is told how to accept a continuation.
  await expect(cue).not.toHaveAttribute('aria-hidden', 'true')
  await expect(
    page.locator('[data-testid="onboarding-cue"][aria-hidden="true"], [aria-hidden="true"] [data-testid="onboarding-cue"]'),
  ).toHaveCount(0)

  // The cue's own words, including the accept-continuation instruction, reach
  // the accessibility tree.
  const axText = await accessibilityText(page)
  expect(axText).toContain(cueText)
  expect(axText).toMatch(ACCEPT_KEY)

  // A keyboard-only user who tabs to the editor is told the instruction, one
  // way or the other: either it is part of what the editor announces, or the
  // cue is a live region that announces itself when it appears. The plan says
  // "announced or otherwise exposed", so either mechanism satisfies it -
  // neither one being present does not.
  const announcement = await editorAnnouncement(page)
  const editorAnnouncesIt = ACCEPT_KEY.test(announcement)
  const cueIsLiveRegion = await cue.evaluate((el) => {
    const live = el.getAttribute('aria-live')
    const role = el.getAttribute('role')
    return live === 'polite' || live === 'assertive' || role === 'status' || role === 'alert'
  })
  expect(
    editorAnnouncesIt || cueIsLiveRegion,
    `The accept-continuation instruction is not reachable by a keyboard-only screen reader user. ` +
      `The editor announces: "${announcement.trim()}", and the cue is not a live region.`,
  ).toBe(true)

  // Not by color alone: the cue carries its meaning as text, so it survives
  // being read rather than seen. An implementation that conveyed "you can
  // start typing" purely through a color or opacity difference would have
  // nothing here to expose.
  expect(cueText.length).toBeGreaterThan(0)
  expect(cueText).toMatch(/\S/)

  // Not covered here: whether VoiceOver and NVDA actually speak this on
  // arrival is a live-reader check the plan calls out as manual. This spec
  // proves the text is exposed and reachable, not that a given reader voices
  // it.
})
