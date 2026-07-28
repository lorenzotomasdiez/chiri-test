import { describe, it, expect } from 'vitest'
import { MODELS, DEFAULT_MODEL_ID, resolveModelId } from './models'
import { createSettingsHandle } from '../storage/settings'

/**
 * T-FR-8-11: a persisted model id that is no longer in the curated catalog.
 *
 * This exercises the boot path exactly as src/state/store.ts runs it:
 * `resolveModelId(settingsHandle.settings.model)`. It lives under src/core
 * because vite.config.ts collects Vitest specs from src/core only; the
 * settings handle is imported rather than reimplemented so the JSON parsing
 * and defaulting under test are the real ones, with a plain object standing in
 * for window.localStorage.
 *
 * The plan leaves the exact fallback undecided - show the stale value as
 * unavailable, or fall back to the default - so the assertion here is the one
 * both readings must satisfy: the app does not crash, and never routes a
 * request at a model outside the current catalog. The default is asserted
 * specifically only where the persisted value carries no information at all.
 */

/** A plain in-memory stand-in for window.localStorage. */
function fakeStorage(seed?: string) {
  const entries = new Map<string, string>()
  if (seed !== undefined) entries.set('chiri-settings', seed)
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    read: () => entries.get('chiri-settings') ?? null,
  }
}

describe('Boot-time resolution of a persisted model selection', () => {
  it('T-FR-8-11: a persisted model no longer in the catalog resolves to a curated one', () => {
    // The user picked this in an earlier session, when it was still curated.
    const storage = fakeStorage(
      JSON.stringify({
        apiKey: 'sk-or-v1-seeded',
        model: 'anthropic/claude-3.5-sonnet',
        continuationEnabled: true,
      }),
    )

    const handle = createSettingsHandle(storage)
    const resolved = resolveModelId(handle.settings.model)

    // Whatever the panel chooses to display, the id a request would go out
    // against is one the catalog currently lists.
    expect(MODELS.some((m) => m.id === resolved)).toBe(true)
    expect(resolved).not.toBe('anthropic/claude-3.5-sonnet')

    // Reading settings is not a migration: the stale value is left in storage,
    // so a catalog that lists the model again later still finds the choice.
    expect(JSON.parse(storage.read() ?? '{}').model).toBe('anthropic/claude-3.5-sonnet')
  })

  it('T-FR-8-11: a settings entry with no usable model falls back to the default', () => {
    // Here there is no user choice to preserve, so the default is the only
    // defensible answer rather than one of two acceptable ones.
    const noInformation = [
      JSON.stringify({ apiKey: 'sk-or-v1-seeded' }), // field absent
      JSON.stringify({ apiKey: 'sk-or-v1-seeded', model: '' }), // empty
      JSON.stringify({ apiKey: 'sk-or-v1-seeded', model: null }), // wrong type
      '{ not json at all',
      undefined, // nothing stored at all: a first-ever session
    ]

    for (const seed of noInformation) {
      const handle = createSettingsHandle(fakeStorage(seed))
      expect(resolveModelId(handle.settings.model)).toBe(DEFAULT_MODEL_ID)
    }
  })

  it('T-FR-8-11: reading a stale selection never throws', () => {
    // The boot read is the one place a bad stored value can take the whole app
    // down before anything renders.
    const hostile = [
      JSON.stringify({ model: 42 }),
      JSON.stringify({ model: { id: 'openai/gpt-4o' } }),
      JSON.stringify(['openai/gpt-4o']),
      JSON.stringify(null),
      '',
    ]

    for (const seed of hostile) {
      expect(() => {
        const handle = createSettingsHandle(fakeStorage(seed))
        resolveModelId(handle.settings.model)
      }).not.toThrow()
    }
  })

  it('T-FR-8-11: a persisted model that is still curated is kept, not reset', () => {
    // The guard against an over-eager fallback that discards a valid choice.
    const storage = fakeStorage(
      JSON.stringify({ apiKey: 'sk-or-v1-seeded', model: 'openai/gpt-4.1' }),
    )

    const handle = createSettingsHandle(storage)
    expect(resolveModelId(handle.settings.model)).toBe('openai/gpt-4.1')
  })
})
