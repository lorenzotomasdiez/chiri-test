import type { Page } from '@playwright/test'

/**
 * WebKit's test automation cannot grant the clipboard-read permission the
 * way Chromium's can, so any spec that reads navigator.clipboard back fails
 * there with NotAllowedError regardless of what the app actually wrote.
 * Stubbing the Clipboard API in-page keeps these specs deterministic across
 * all three browsers instead of depending on OS/browser clipboard
 * permissions that are granted inconsistently (or not at all) in headless
 * automation.
 */
export async function mockClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let clipboardText = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          clipboardText = text
        },
        readText: async () => clipboardText,
      },
      configurable: true,
    })
  })
}
