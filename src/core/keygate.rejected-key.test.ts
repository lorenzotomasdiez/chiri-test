import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'
import type { Transport } from './schedule'

interface FakeSettings {
  apiKey?: string
  model?: string
  continuationEnabled?: boolean
}

describe('KeyGate rejection handling', () => {
  it('T-FR-1-5: Keys OpenRouter rejects stay blocked with a rejection message', async () => {
    // First gate: submit an invalid key
    const settings1: FakeSettings = {}
    const transport1: Transport = async (_req, _signal) => {
      throw new Error('Invalid API key')
    }

    const gate1 = new KeyGate({
      transport: transport1 as Transport,
      settings: settings1,
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
    })

    await gate1.submit('not-a-key')

    expect(gate1.state).toBe('blocked-error')
    expect(gate1.failure?.kind).toBe('rejected')
    expect(gate1.failure?.message).toBeTruthy()
    expect(typeof gate1.failure?.message).toBe('string')
    expect(gate1.failure.message.length).toBeGreaterThan(0)
    expect(settings1.apiKey).toBeUndefined()

    // Second gate: submit a revoked key that returns HTTP 401
    const settings2: FakeSettings = {}
    const transport2: Transport = async (_req, _signal) => {
      const error = new Error('Unauthorized')
      ;(error as any).status = 401
      throw error
    }

    const gate2 = new KeyGate({
      transport: transport2 as Transport,
      settings: settings2,
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
    })

    await gate2.submit('sk-or-v1-revoked-example-key')

    expect(gate2.state).toBe('blocked-error')
    expect(gate2.failure?.kind).toBe('rejected')
    expect(gate2.failure?.message).toBeTruthy()
    expect(typeof gate2.failure?.message).toBe('string')
    expect(gate2.failure.message.length).toBeGreaterThan(0)
    expect(settings2.apiKey).toBeUndefined()

    // Message should differ from incomplete and account messages
    const incompleteMessage = 'network error or rate limited'
    const accountMessage = 'insufficient credit or account restricted'
    expect(gate1.failure.message).not.toContain('network')
    expect(gate1.failure.message).not.toContain('rate')
    expect(gate1.failure.message).not.toContain('credit')
    expect(gate1.failure.message).not.toContain('restricted')
    expect(gate2.failure.message).not.toContain('network')
    expect(gate2.failure.message).not.toContain('rate')
    expect(gate2.failure.message).not.toContain('credit')
    expect(gate2.failure.message).not.toContain('restricted')
  })
})
