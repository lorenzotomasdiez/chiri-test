import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'

interface FakeSettings {
  apiKey?: string
  model?: string
  continuationEnabled?: boolean
}

describe('KeyGate resubmission after a rejected key', () => {
  it('T-FR-1-18: correcting and resubmitting from blocked-error validates again and can unblock', async () => {
    let callCount = 0
    const settings: FakeSettings = {}

    const transport = (_req: unknown, _signal: AbortSignal): Promise<unknown> => {
      callCount++
      if (callCount === 1) {
        const error = new Error('Invalid API key')
        return Promise.reject(error)
      }
      return Promise.resolve({ status: 200, ok: true })
    }

    const gate = new KeyGate({
      transport: transport as any,
      settings,
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
    })

    await gate.submit('not-a-key')
    expect(gate.state).toBe('blocked-error')
    expect(gate.failure?.kind).toBe('rejected')

    const resubmission = gate.submit('sk-or-v1-corrected-key')
    // submit() flips to 'validating' synchronously before the transport's
    // first await, dropping the prior rejection's failure immediately -
    // the stale error message must not linger while the new attempt runs.
    expect(gate.state).toBe('validating')
    expect(gate.failure).toBeUndefined()

    await resubmission

    expect(callCount).toBe(2)
    expect(gate.state).toBe('unblocked')
    expect(gate.failure).toBeUndefined()
    expect(settings.apiKey).toBe('sk-or-v1-corrected-key')
  })
})
