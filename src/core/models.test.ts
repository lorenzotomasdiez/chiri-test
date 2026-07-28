import { describe, it, expect } from 'vitest'
import { MODELS, DEFAULT_MODEL_ID } from './models'

describe('models catalog', () => {
  it('T-CC-MODEL-6: exports a curated catalog with short friendly names and capability notes', () => {
    // CC-MODEL.11: length is between 3 and 5 inclusive
    expect(MODELS.length).toBeGreaterThanOrEqual(3)
    expect(MODELS.length).toBeLessThanOrEqual(5)

    // AC-8.1: DEFAULT_MODEL_ID is exactly 'openai/gpt-4o-mini'
    expect(DEFAULT_MODEL_ID).toBe('openai/gpt-4o-mini')

    // Find the entries by id
    const miniEntry = MODELS.find((m) => m.id === 'openai/gpt-4o-mini')
    const gpt4oEntry = MODELS.find((m) => m.id === 'openai/gpt-4o')
    const gpt41Entry = MODELS.find((m) => m.id === 'openai/gpt-4.1')

    // Verify all three required entries exist
    expect(miniEntry).toBeDefined()
    expect(gpt4oEntry).toBeDefined()
    expect(gpt41Entry).toBeDefined()

    // AC-8.1 + CC-MODEL.2: GPT-4o mini entry
    expect(miniEntry?.displayName).toBe('GPT-4o mini')
    expect(miniEntry?.capabilityNote).toBe('fast, low cost')

    // CC-MODEL.2: GPT-4o entry
    expect(gpt4oEntry?.displayName).toBe('GPT-4o')
    expect(gpt4oEntry?.capabilityNote).toBe('stronger reasoning, slower')

    // CC-MODEL.2: GPT-4.1 entry
    expect(gpt41Entry?.displayName).toBe('GPT-4.1')
    expect(gpt41Entry?.capabilityNote).toBe('large context')

    // CC-MODEL.2, CUT.5: every displayName is non-empty and contains no '/'
    MODELS.forEach((model) => {
      expect(model.displayName).toBeTruthy()
      expect(model.displayName).not.toContain('/')
    })

    // CC-MODEL.7: every capabilityNote is a non-empty string
    MODELS.forEach((model) => {
      expect(typeof model.capabilityNote).toBe('string')
      expect(model.capabilityNote.length).toBeGreaterThan(0)
    })

    // CC-MODEL.2: all displayName values are unique
    const displayNames = MODELS.map((m) => m.displayName)
    const uniqueDisplayNames = new Set(displayNames)
    expect(uniqueDisplayNames.size).toBe(displayNames.length)
  })
})
