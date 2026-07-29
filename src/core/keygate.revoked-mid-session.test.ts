import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'

interface FakeSettings {
  apiKey?: string
  model?: string
  continuationEnabled?: boolean
}

/** A transport that returns a controllable promise and records its AbortSignal. */
function controllableTransport() {
  let capturedSignal: AbortSignal
  let resolveResponse: (value: unknown) => void

  const promise = new Promise<unknown>((resolve) => {
    resolveResponse = resolve
  })

  // Annotated rather than inferred: matches the pattern in
  // keygate.cancel-discards-late-response.test.ts, since the body references
  // the function's own return type, which tsc cannot resolve circularly.
  const transport = (_req: unknown, signal: AbortSignal): Promise<unknown> => {
    capturedSignal = signal
    return promise
  }

  return {
    transport: transport as (req: unknown, signal: AbortSignal) => Promise<unknown>,
    getCapturedSignal: () => capturedSignal!,
    resolveResponse: resolveResponse!,
  }
}

describe('KeyGate.revoke (AC-12.4)', () => {
  it('drops the stored key and moves an unblocked gate to blocked-revoked with a rejected failure', () => {
    const settings: FakeSettings = { apiKey: 'sk-or-v1-already-validated' }
    const keygate = new KeyGate({
      transport: async () => ({ status: 200, ok: true }),
      settings,
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
    })

    expect(keygate.state).toBe('unblocked')

    keygate.revoke()

    expect(keygate.state).toBe('blocked-revoked')
    expect(keygate.failure?.kind).toBe('rejected')
    expect(settings.apiKey).toBe('')
  })

  it('a submit() already in flight when revoke() fires cannot flip state back to unblocked once it resolves', async () => {
    const { transport, getCapturedSignal, resolveResponse } = controllableTransport()
    const settings: FakeSettings = { apiKey: 'sk-or-v1-already-validated' }
    const keygate = new KeyGate({
      transport,
      settings,
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
    })

    // A re-validation submit starts (e.g. the user re-typed a key) and is still in flight.
    const submitPromise = keygate.submit('sk-or-v1-another-candidate')
    expect(keygate.state).toBe('validating')

    // The stored key is revoked mid-session by an unrelated request before the submit settles.
    keygate.revoke()

    expect(keygate.state).toBe('blocked-revoked')
    expect(settings.apiKey).toBe('')
    expect(getCapturedSignal().aborted).toBe(true)

    // The stale submit's response now resolves successfully.
    resolveResponse({ status: 200, ok: true })
    await submitPromise

    // The generation guard must keep the stale success from resurrecting 'unblocked'.
    expect(keygate.state).toBe('blocked-revoked')
    expect(settings.apiKey).toBe('')
  })
})
