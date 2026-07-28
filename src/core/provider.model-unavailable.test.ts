import { describe, it, expect } from 'vitest'
import { classifyFailure } from './provider'

/**
 * T-FR-8-8's classification half.
 *
 * The scenario's other half - that the default option stays selectable in the
 * panel immediately after the failure, with no extra unblocking step - is a
 * browser assertion, and it needs a request the user can actually trigger from
 * the UI. src/core/schedule.ts is not yet wired into src/components/Editor.tsx,
 * so nothing in the running app issues a continuation or revision request that
 * could fail. That half is deferred until FR-5 / FR-6 / FR-12 wire the
 * scheduler to the editor, rather than being simulated here against a request
 * path that does not exist.
 */
describe('Provider model-unavailable failure classification', () => {
  const modelUnavailableError = {
    status: 404,
    body: {
      error: {
        code: 404,
        message: 'No endpoints found for openai/gpt-4.1',
      },
    },
  }

  it('T-FR-8-8: a model-unavailable rejection is not classified as a bad key', () => {
    const failure = classifyFailure(modelUnavailableError)

    // The distinction that matters. Reporting a 404 for an unavailable model as
    // 'rejected' - the bad-key kind - sends the user to the key gate to fix a
    // key that is working fine.
    expect(failure.kind).not.toBe('rejected')
    expect(failure.kind).toBe('unknown')
  })

  it('T-FR-8-8: the surfaced message is one line and leaks neither the key nor the raw provider text', () => {
    const failure = classifyFailure(modelUnavailableError)

    // AC-1.11: the canonical line for this kind, never an echo of the provider.
    expect(failure.message).toBe('The key could not be validated: unexpected response.')
    expect(failure.message).not.toMatch(/[\r\n]/)

    // Nothing from the raw error shape reaches the user.
    expect(failure.message).not.toContain('No endpoints found')
    expect(failure.message).not.toContain('openai/gpt-4.1')
    expect(failure.message).not.toContain('404')
    expect(failure.message).not.toContain('sk-')
  })

  it('T-FR-8-8: classification never throws, whatever shape the provider sends', () => {
    // The failure path must not itself become the failure: if this throws, a
    // model-unavailable response takes the app down instead of surfacing a line.
    const shapes: unknown[] = [
      modelUnavailableError,
      { status: 404 },
      { status: 404, body: {} },
      { body: { error: { code: 404 } } },
      new TypeError('Failed to fetch'),
      null,
      undefined,
      'not an object',
    ]

    for (const shape of shapes) {
      expect(() => classifyFailure(shape)).not.toThrow()
      const failure = classifyFailure(shape)
      expect(typeof failure.kind).toBe('string')
      expect(failure.message.length).toBeGreaterThan(0)
      expect(failure.message).not.toMatch(/[\r\n]/)
    }
  })
})
