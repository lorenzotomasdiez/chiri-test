import type { Page } from '@playwright/test'

/**
 * Puts a validated key on file before the app boots, so the FR-1 gate is
 * already passed and the shell exists.
 *
 * Every spec that exercises the top bar, the document column, or the editor
 * needs this: per AC-1.1 there is no editor before a key is on file, and per
 * CC-NAV.12 there is no top bar either. The gate is a genuine precondition of
 * the shell, not an obstacle to route around, so these specs state it rather
 * than assuming a shell that only exists afterwards.
 *
 * The key never leaves the browser - no spec here makes a real OpenRouter
 * request. A stored key is trusted at boot without re-validation (AC-1.8), so
 * no network interception is needed to satisfy the precondition.
 */
export const SEEDED_API_KEY = 'sk-or-v1-e2e-seeded-key'

/** The single localStorage entry the app persists (src/storage/settings.ts). */
const STORAGE_KEY = 'chiri-settings'

export async function seedValidatedKey(page: Page) {
  await page.addInitScript(
    ([storageKey, apiKey]) => {
      // Merge rather than overwrite. This init script re-runs on every
      // navigation, including page.reload(), so writing `{ apiKey }` whole
      // would erase every other persisted field - model, continuationEnabled -
      // before the app boots and reads them back. A spec that reloads to prove
      // something persisted would then be proving only that this helper
      // rewrote it.
      let existing: Record<string, unknown> = {}
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed: unknown = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') existing = parsed as Record<string, unknown>
        }
      } catch {
        existing = {}
      }
      localStorage.setItem(storageKey, JSON.stringify({ ...existing, apiKey }))
    },
    [STORAGE_KEY, SEEDED_API_KEY] as const,
  )
}
