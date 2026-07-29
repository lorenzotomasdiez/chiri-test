/**
 * T-FR-12-10 and T-FR-12-11's stream-cut case, at the decoder that has to
 * tell "the model wrote this much" apart from "this much of what the model
 * wrote arrived". The two look identical in the assembled text, so the
 * distinction can only come from whether the provider ever said it was
 * finished - which is what `sawTerminator` reports.
 */

import { describe, expect, it } from 'vitest'
import { createCompletionStreamDecoder } from './provider'

function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

describe('completion stream termination', () => {
  it('reports a complete stream once the [DONE] frame arrives', () => {
    const decoder = createCompletionStreamDecoder()
    decoder.push(frame('reason: shorter\n') + frame('--sep--\n') + frame('A shorter line.'))
    expect(decoder.sawTerminator()).toBe(false)

    decoder.push('data: [DONE]\n\n')
    expect(decoder.sawTerminator()).toBe(true)
  })

  it('reports an incomplete stream when the connection closes mid-response', () => {
    const decoder = createCompletionStreamDecoder()
    // The reason line and the sentinel both arrived, so the response parses -
    // which is exactly why the parse cannot be what decides completeness.
    const text = decoder.push(frame('reason: shorter\n') + frame('--sep--\n') + frame('A shorter'))
    decoder.flush()

    expect(text).toContain('--sep--')
    expect(decoder.sawTerminator()).toBe(false)
  })

  it('accepts a finish_reason as termination, for a body with no [DONE] frame', () => {
    const decoder = createCompletionStreamDecoder()
    decoder.push(
      `data: ${JSON.stringify({
        choices: [{ index: 0, delta: { content: 'done' }, finish_reason: 'stop' }],
      })}\n\n`,
    )
    expect(decoder.sawTerminator()).toBe(true)
  })

  it('treats a non-streamed body as complete', () => {
    const decoder = createCompletionStreamDecoder()
    const text = decoder.push(
      `data: ${JSON.stringify({ choices: [{ index: 0, message: { content: 'whole answer' } }] })}\n\n`,
    )
    expect(text).toBe('whole answer')
    expect(decoder.sawTerminator()).toBe(true)
  })

  it('reports an empty [DONE]-only stream as complete but contentless', () => {
    // AC-12.6's empty-body case: terminated properly, carrying nothing. The
    // caller distinguishes the two - the decoder only reports what arrived.
    const decoder = createCompletionStreamDecoder()
    const text = decoder.push('data: [DONE]\n\n')
    expect(text).toBe('')
    expect(decoder.sawTerminator()).toBe(true)
  })
})
