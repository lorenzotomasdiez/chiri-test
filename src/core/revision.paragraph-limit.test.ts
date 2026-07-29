import { describe, it, expect } from 'vitest'
import { checkParagraphCount } from './revision'

describe('Paragraph count guard', () => {
  it('T-FR-6-9: A selection over more than three paragraphs is refused with a visible message', () => {
    // Given a selection spanning five consecutive prose paragraphs
    const fiveParagraphSelection = 'P1.\n\nP2.\n\nP3.\n\nP4.\n\nP5.'

    // When a revision is requested against the paragraph-count guard
    const result = checkParagraphCount(fiveParagraphSelection)

    // Then the guard returns a refusal carrying a visible message
    if (result.kind !== 'refused') {
      throw new Error(`expected a five-paragraph selection to be refused, got ${result.kind}`)
    }
    expect(typeof result.message).toBe('string')
    expect(result.message.length).toBeGreaterThan(0)

    // And no request body is produced
    expect(result.requestBody).toBeUndefined()
  })

  it('T-FR-6-9: Two-paragraph selections are accepted and proceed', () => {
    // Given a selection spanning exactly two paragraphs
    const twoParagraphSelection = 'P1.\n\nP2.'

    // When checked against the paragraph-count guard
    const result = checkParagraphCount(twoParagraphSelection)

    // Then the guard accepts it
    expect(result.kind).toBe('accepted')
  })

  it('T-FR-6-9: Three-paragraph selections are accepted and proceed', () => {
    // Given a selection spanning exactly three paragraphs
    const threeParagraphSelection = 'P1.\n\nP2.\n\nP3.'

    // When checked against the paragraph-count guard
    const result = checkParagraphCount(threeParagraphSelection)

    // Then the guard accepts it
    expect(result.kind).toBe('accepted')
  })

  it('T-FR-6-9: Four-paragraph selections are refused at the boundary', () => {
    // Given a selection spanning four paragraphs (at the refusal boundary)
    const fourParagraphSelection = 'P1.\n\nP2.\n\nP3.\n\nP4.'

    // When checked against the paragraph-count guard
    const result = checkParagraphCount(fourParagraphSelection)

    // Then the guard refuses it with a visible message
    if (result.kind !== 'refused') {
      throw new Error(`expected a four-paragraph selection to be refused, got ${result.kind}`)
    }
    expect(typeof result.message).toBe('string')
    expect(result.message.length).toBeGreaterThan(0)
  })
})
