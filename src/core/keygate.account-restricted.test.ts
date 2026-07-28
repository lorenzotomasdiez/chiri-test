import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'

describe('KeyGate - account-restricted response', () => {
  it('T-FR-1-7: A key that authenticates but cannot make requests gets an account-condition message', async () => {
    const transport = async (_key: string, _signal: AbortSignal) => {
      // Simulate OpenRouter 402 response: authenticated but insufficient credits
      throw {
        status: 402,
        body: {
          error: {
            code: 402,
            message: 'Insufficient credits',
          },
        },
      }
    }

    const settings = { apiKey: '', model: '', continuationEnabled: true }
    const keygate = new KeyGate({
      transport,
      settings,
      now: () => Date.now(),
      setTimeout,
    })

    // Submit the key
    await keygate.submit('sk-or-v1-valid-example-key')

    // State should be blocked-error
    expect(keygate.state).toBe('blocked-error')

    // Failure kind should be 'account'
    expect(keygate.failure?.kind).toBe('account')

    // Message should reference the account condition (credit or restriction)
    const message = keygate.failure?.message || ''
    expect(message.toLowerCase()).toMatch(/credit|restrict|insufficient/)

    // Message should not be the 'rejected' message (which would be for invalid key)
    expect(message.toLowerCase()).not.toMatch(/invalid.*key|unauthorized|401/)

    // settings.apiKey was never written
    expect(settings.apiKey).toBe('')
  })
})
