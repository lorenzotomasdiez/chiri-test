import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KeyGate } from './keygate'

/** A transport that returns a controllable promise and records its AbortSignal. */
function controllableTransport() {
  let capturedSignal: AbortSignal
  let resolveResponse: (value: unknown) => void

  const promise = new Promise((resolve) => {
    resolveResponse = resolve
  })

  const transport = (_req: unknown, signal: AbortSignal) => {
    capturedSignal = signal
    return promise as ReturnType<typeof transport>
  }

  return {
    transport: transport as (req: unknown, signal: AbortSignal) => Promise<unknown>,
    getCapturedSignal: () => capturedSignal,
    resolveResponse: resolveResponse!,
  }
}

describe('KeyGate', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('T-FR-1-9: Cancelling an in-flight validation abandons the request and keeps the typed value', () => {
    const { transport, getCapturedSignal, resolveResponse } = controllableTransport()
    const settings = { apiKey: '', model: 'default', continuationEnabled: false }
    const keygate = new KeyGate({
      transport,
      settings,
      now: () => Date.now(),
      setTimeout: global.setTimeout,
    })

    // Submit the key
    keygate.submit('sk-or-v1-valid-example-key')
    expect(keygate.state).toBe('validating')

    // Cancel the in-flight request
    keygate.cancel()

    // Resolve the held promise with a 200 success
    resolveResponse({ status: 200, ok: true })

    // The recorded signal.aborted should be true
    expect(getCapturedSignal().aborted).toBe(true)

    // State should remain 'blocked-empty' and never became 'unblocked'
    expect(keygate.state).toBe('blocked-empty')

    // settings.apiKey was never written
    expect(settings.apiKey).toBe('')

    // The retained draft value is still exactly 'sk-or-v1-valid-example-key'
    expect(keygate.draftValue).toBe('sk-or-v1-valid-example-key')
  })
})
