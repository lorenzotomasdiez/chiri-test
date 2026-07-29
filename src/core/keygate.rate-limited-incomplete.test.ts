import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'
import type { Transport } from './schedule'

describe('KeyGate - rate-limited validation handling', () => {
  it('T-FR-1-8: A 429 rate-limit response is treated as incomplete, not rejected, with retry available', async () => {
    let attempts = 0
    // Untyped, cast only at the call site: annotating this inline as
    // `Transport` directly makes tsc -b infer the second branch's return as
    // Promise<void>, which isn't assignable to Transport's AsyncIterable
    // return shape even though plain tsc --noEmit and vitest both accept it.
    // Same pattern as keygate.cancel-discards-late-response.test.ts's
    // controllableTransport().
    const transport = (async (): Promise<unknown> => {
      attempts++
      if (attempts === 1) throw { status: 429 }
      return undefined
    }) as unknown as Transport

    const settings = { apiKey: '', model: '', continuationEnabled: true }
    const keygate = new KeyGate({
      transport,
      settings,
      now: () => Date.now(),
      setTimeout,
    })

    await keygate.submit('sk-or-v1-valid-example-key')

    // State should be blocked-error, matching the network-failure family, not rejected
    expect(keygate.state).toBe('blocked-error')
    expect(keygate.failure?.kind).toBe('incomplete')

    const message = keygate.failure?.message ?? ''
    expect(message.toLowerCase()).not.toContain('rejected')
    expect(settings.apiKey).toBe('')

    // The typed value is retained, so a retry can be issued without re-typing the key
    expect(keygate.draftValue).toBe('sk-or-v1-valid-example-key')

    // Retrying the same value succeeds now that the rate limit has cleared
    await keygate.submit(keygate.draftValue)
    expect(keygate.state).toBe('unblocked')
    expect(settings.apiKey).toBe('sk-or-v1-valid-example-key')
  })
})
