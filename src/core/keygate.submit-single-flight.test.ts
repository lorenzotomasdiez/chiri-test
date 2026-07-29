import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'

interface FakeSettings {
  apiKey?: string
  model?: string
  continuationEnabled?: boolean
}

/** A transport that counts invocations and returns a controllable promise. */
function controllableTransport() {
  let callCount = 0
  let resolveResponse: (value: unknown) => void

  const promise = new Promise<unknown>((resolve) => {
    resolveResponse = resolve
  })

  // Annotated rather than inferred: the body references the function's own
  // return type, which tsc cannot resolve circularly.
  const transport = (_req: unknown, _signal: AbortSignal): Promise<unknown> => {
    callCount++
    return promise
  }

  return {
    transport: transport as (req: unknown, signal: AbortSignal) => Promise<unknown>,
    getCallCount: () => callCount,
    resolveResponse: resolveResponse!,
  }
}

describe('KeyGate single-flight submission', () => {
  it('T-FR-1-19: a second submit while validating is a no-op, exactly one request fires', async () => {
    const { transport, getCallCount, resolveResponse } = controllableTransport()

    const settings: FakeSettings = {}
    const gate = new KeyGate({
      transport: transport as any,
      settings,
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
    })

    const first = gate.submit('sk-or-v1-example-key')
    // The first submit's transport call has started (state flipped
    // synchronously before the first await), so a second activation now
    // races the same in-flight validation.
    expect(gate.state).toBe('validating')

    const second = gate.submit('sk-or-v1-example-key')

    await second
    expect(getCallCount()).toBe(1)
    expect(gate.state).toBe('validating')

    resolveResponse({ status: 200, ok: true })
    await first

    expect(getCallCount()).toBe(1)
    expect(gate.state).toBe('unblocked')
    expect(settings.apiKey).toBe('sk-or-v1-example-key')
  })
})
