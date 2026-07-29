import { describe, it, expect } from 'vitest'
import { createSettingsHandle } from '../storage/settings'

/**
 * T-FR-1-17: local storage unavailable at boot or mid-session. PRD Q1-b
 * settles this as "runs in memory with a warning" rather than a crash or a
 * refusal to start - this covers the handle's half of that contract
 * (keyPersisted flips to false rather than throwing out of the setter);
 * src/components/StorageWarningBanner.tsx covers the visible-warning half.
 *
 * Lives under src/core (not src/storage) because vite.config.ts collects
 * Vitest specs from src/core only, matching the existing
 * models.stale-persisted-model.test.ts precedent for testing a
 * src/storage module from here.
 */

/** A storage stand-in whose every write throws, as a full-or-blocked localStorage would. */
function throwingStorage() {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }
}

/** A plain in-memory stand-in for window.localStorage. */
function workingStorage() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
  }
}

describe('The settings handle degrades to memory rather than throwing', () => {
  it('T-FR-1-17: keyPersisted starts true and flips to false the first time a write throws', () => {
    const handle = createSettingsHandle(throwingStorage())

    expect(handle.keyPersisted).toBe(true)

    expect(() => {
      handle.settings.apiKey = 'sk-or-v1-typed'
    }).not.toThrow()

    expect(handle.keyPersisted).toBe(false)
    // The in-memory value itself is unaffected - only the persistence signal is.
    expect(handle.settings.apiKey).toBe('sk-or-v1-typed')
  })

  it('T-FR-1-17: keyPersisted stays true across writes to storage that works', () => {
    const handle = createSettingsHandle(workingStorage())

    handle.settings.apiKey = 'sk-or-v1-typed'
    handle.settings.model = 'openai/gpt-4.1'
    handle.settings.continuationEnabled = false

    expect(handle.keyPersisted).toBe(true)
  })

  it('T-FR-1-17: keyPersisted recovers to true once a later write succeeds', () => {
    let broken = true
    const entries = new Map<string, string>()
    const flaky = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (broken) throw new Error('QuotaExceededError')
        entries.set(key, value)
      },
    }
    const handle = createSettingsHandle(flaky)

    handle.settings.apiKey = 'sk-or-v1-first'
    expect(handle.keyPersisted).toBe(false)

    broken = false
    handle.settings.apiKey = 'sk-or-v1-second'
    expect(handle.keyPersisted).toBe(true)
  })
})
