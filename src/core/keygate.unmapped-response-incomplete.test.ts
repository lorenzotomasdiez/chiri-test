import { describe, it, expect } from 'vitest'
import { KeyGate } from './keygate'
import type { Transport } from './schedule'

describe('KeyGate - unmapped/ambiguous validation response handling', () => {
  it('T-FR-1-20: an unmapped response (e.g. a raw 500) leaves the app blocked with a message, not stuck validating or misreported as validated', async () => {
    const transport: Transport = () => {
      throw { status: 500 }
    }

    const settings = { apiKey: '', model: '', continuationEnabled: true }
    const keygate = new KeyGate({
      transport,
      settings,
      now: () => Date.now(),
      setTimeout,
    })

    await keygate.submit('sk-or-v1-valid-example-key')

    // Never left hanging in validating, and never misreported as unblocked.
    expect(keygate.state).toBe('blocked-error')
    expect(keygate.failure?.kind).toBe('unknown')
    expect(keygate.failure?.message.length).toBeGreaterThan(0)
    expect(settings.apiKey).toBe('')
  })

  it('T-FR-1-20: a malformed response body (no recognizable status or shape) is classified the same way', async () => {
    const transport: Transport = () => {
      throw { body: { unexpected: 'shape' } }
    }

    const settings = { apiKey: '', model: '', continuationEnabled: true }
    const keygate = new KeyGate({
      transport,
      settings,
      now: () => Date.now(),
      setTimeout,
    })

    await keygate.submit('sk-or-v1-valid-example-key')

    expect(keygate.state).toBe('blocked-error')
    expect(keygate.failure?.kind).toBe('unknown')
    expect(settings.apiKey).toBe('')
  })
})
