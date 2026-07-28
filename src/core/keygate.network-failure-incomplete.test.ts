import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'
import type { Transport } from './schedule'

describe('KeyGate - network failure handling', () => {
  it('T-FR-1-6: A network failure during validation reports an incomplete check, not a rejection', async () => {
    const transport: Transport = () => {
      throw new TypeError('Failed to fetch')
    }

    const settings = { apiKey: '', model: '', continuationEnabled: true }
    const keygate = new KeyGate({
      transport,
      settings,
      now: () => Date.now(),
      setTimeout,
    })

    // Submit a valid-looking key
    await keygate.submit('sk-or-v1-valid-example-key')

    // State should be blocked-error
    expect(keygate.state).toBe('blocked-error')

    // Failure kind should be incomplete, not rejected
    expect(keygate.failure).toBeDefined()
    expect(keygate.failure?.kind).toBe('incomplete')

    // Message should not contain 'invalid' or 'rejected' (case-insensitive)
    const message = keygate.failure?.message ?? ''
    expect(message.toLowerCase()).not.toContain('invalid')
    expect(message.toLowerCase()).not.toContain('rejected')

    // settings.apiKey was never written
    expect(settings.apiKey).toBe('')
  })
})
