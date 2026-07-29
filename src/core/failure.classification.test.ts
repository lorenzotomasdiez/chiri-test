/**
 * FR-12's classification rules, at the layer that decides what the user is
 * told and whether the key gate goes back up. Covers the response shapes
 * behind AC-12.2 through AC-12.6, plus T-FR-12-8's requirement that the three
 * conditions a user can act on differently read differently.
 */

import { describe, expect, it } from 'vitest'
import { classifyRequestFailure, isAbort, MalformedResponseError } from './failure'

describe('classifyRequestFailure', () => {
  it('reads an unreachable network as a network failure (AC-12.1, AC-12.2)', () => {
    const failure = classifyRequestFailure(new TypeError('Failed to fetch'))
    expect(failure.kind).toBe('network')
    expect(failure.routesToKeyGate).toBe(false)
  })

  it('reads a 429 as a rate limit rather than as an outage (AC-12.3)', () => {
    expect(classifyRequestFailure({ status: 429 }).kind).toBe('rate-limit')
  })

  it('reads a 402 as credit exhaustion, without blocking the editor (AC-12.5)', () => {
    const failure = classifyRequestFailure({ status: 402 })
    expect(failure.kind).toBe('credit')
    // Credit is a condition of a working key, so it never routes to the gate -
    // the editor has to stay fully usable for writing.
    expect(failure.routesToKeyGate).toBe(false)
  })

  it('reads a credit message with no status as credit exhaustion', () => {
    const failure = classifyRequestFailure({
      body: { error: { message: 'Insufficient credits for this request' } },
    })
    expect(failure.kind).toBe('credit')
  })

  it('routes a 401 back to the key gate (AC-12.4)', () => {
    const failure = classifyRequestFailure({ status: 401 })
    expect(failure.kind).toBe('key-rejected')
    expect(failure.routesToKeyGate).toBe(true)
  })

  it('routes a 403 back to the key gate too, since the credential is what is refused', () => {
    expect(classifyRequestFailure({ status: 403 }).routesToKeyGate).toBe(true)
  })

  it('reads a truncated or unreadable response as malformed (AC-12.6)', () => {
    const failure = classifyRequestFailure(new MalformedResponseError())
    expect(failure.kind).toBe('malformed')
    expect(failure.routesToKeyGate).toBe(false)
  })

  it('falls back to unknown for an unrecognised provider status', () => {
    expect(classifyRequestFailure({ status: 500 }).kind).toBe('unknown')
  })

  it('gives network, rate limit, and credit three distinct lines (T-FR-12-8)', () => {
    const lines = [
      classifyRequestFailure(new TypeError('Failed to fetch')).message,
      classifyRequestFailure({ status: 429 }).message,
      classifyRequestFailure({ status: 402 }).message,
    ]
    expect(new Set(lines).size).toBe(3)
    // The credit line has to name credit as the cause, not merely differ.
    expect(lines[2]).toMatch(/credit/i)
  })

  it('never echoes the raw error text into what the user is shown (NFR-3)', () => {
    const failure = classifyRequestFailure({
      status: 401,
      body: { error: { message: 'No auth credentials found for sk-or-v1-secret' } },
    })
    expect(failure.message).not.toContain('sk-or-v1-secret')
  })
})

describe('isAbort', () => {
  it('recognises a cancelled request, which is not a failure (T-FR-12-18)', () => {
    const controller = new AbortController()
    controller.abort()
    expect(isAbort(controller.signal.reason)).toBe(true)
  })

  it('does not mistake a genuine network failure for a cancellation', () => {
    expect(isAbort(new TypeError('Failed to fetch'))).toBe(false)
    expect(isAbort({ status: 429 })).toBe(false)
  })
})
