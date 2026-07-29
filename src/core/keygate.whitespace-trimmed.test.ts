import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'

interface FakeSettings {
  apiKey?: string
  model?: string
  continuationEnabled?: boolean
}

describe('KeyGate whitespace trimming', () => {
  it('T-FR-1-11: leading/trailing whitespace is trimmed before it reaches the transport', async () => {
    const settings: FakeSettings = {}
    const received: unknown[] = []

    const transport = (req: unknown, _signal: AbortSignal): Promise<unknown> => {
      received.push(req)
      return Promise.resolve({ status: 200, ok: true })
    }

    const gate = new KeyGate({
      transport: transport as any,
      settings,
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
    })

    await gate.submit('  sk-or-v1-valid-example-key  ')

    expect(received).toEqual(['sk-or-v1-valid-example-key'])
    expect(settings.apiKey).toBe('sk-or-v1-valid-example-key')
    expect(gate.state).toBe('unblocked')
  })
})
