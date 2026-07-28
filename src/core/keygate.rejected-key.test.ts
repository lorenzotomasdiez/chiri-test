import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'
import type { Transport } from './schedule'
import type { Failure } from './provider'

interface FakeSettings {
  apiKey?: string
  model?: string
  continuationEnabled?: boolean
}

/**
 * Narrows the gate's optional failure to a present one. Optional chaining
 * would type-check, but `expect(undefined).not.toContain(...)` passes
 * vacuously - a missing failure would then look like a correctly worded one.
 */
function requireFailure(failure: Failure | undefined): Failure {
  if (!failure) throw new Error('expected the gate to have recorded a failure')
  return failure
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
    const failure1 = requireFailure(gate1.failure)
    expect(failure1.message.length).toBeGreaterThan(0)
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
    const failure2 = requireFailure(gate2.failure)
    expect(failure2.message.length).toBeGreaterThan(0)
    expect(settings2.apiKey).toBeUndefined()

    // Message should differ from the incomplete ('network error or rate
    // limited') and account ('insufficient credit or account restricted')
    // messages, which the assertions below check term by term.
    for (const message of [failure1.message, failure2.message]) {
      expect(message).not.toContain('network')
      expect(message).not.toContain('rate')
      expect(message).not.toContain('credit')
      expect(message).not.toContain('restricted')
    }
  })
})
