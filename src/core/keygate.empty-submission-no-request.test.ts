import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'
import type { Transport } from './schedule'

describe('KeyGate - empty submission guard', () => {
  it('T-FR-1-10: Empty or whitespace-only submissions make no request', () => {
    let callCount = 0
    const transport: Transport = () => {
      callCount++
      // Transport returns an async iterable, or a promise of one. The generator
      // has to be invoked before it is wrapped, not after: `Promise.resolve(fn)()`
      // resolves to the function itself and is then not callable.
      return Promise.resolve((async function* () {})())
    }

    const settings = { apiKey: '', model: '', continuationEnabled: true }
    const keygate = new KeyGate({
      transport,
      settings,
      now: () => Date.now(),
      setTimeout,
    })

    // Submit empty string
    keygate.submit('')
    expect(callCount).toBe(0)
    expect(keygate.state).toBe('blocked-empty')
    expect(keygate.failure).toBeUndefined()

    // Submit whitespace only
    keygate.submit('   ')
    expect(callCount).toBe(0)
    expect(keygate.state).toBe('blocked-empty')
    expect(keygate.failure).toBeUndefined()

    // Verify settings.apiKey was never written
    expect(settings.apiKey).toBe('')
  })
})
