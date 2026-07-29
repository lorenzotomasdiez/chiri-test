import { describe, it, expect } from 'vitest'
import { validateResponseSpan } from './revision'

describe('Response span containment', () => {
  it('T-FR-6-8: A response touching text outside the selected span is rejected entirely', () => {
    // Set up the document and selection
    const documentText = 'Sales rose in Q1. The team shipped two features.'
    // Selected span is the second sentence: "The team shipped two features."
    // Starting at character 19 (after "Sales rose in Q1. ")
    const selectedStart = 19
    const selectedEnd = 49

    // Case 1: Response that touches text outside the span
    // This response rewrites both sentences instead of just the selected one
    const outOfSpanResponse = 'Revenue climbed in Q1. The team shipped two features and a fix.'

    // Should be rejected - no Pending state produced, returns a declined result
    const rejectedResult = validateResponseSpan(
      documentText,
      selectedStart,
      selectedEnd,
      outOfSpanResponse,
    )

    expect(rejectedResult.kind).toBe('declined')
    expect(rejectedResult.accepted).toBe(false)

    // Verify that document text is unchanged
    expect(rejectedResult.documentText).toBe(documentText)

    // Case 2: Response confined to the selected span
    // This response only rewrites the second sentence
    const inSpanResponse = 'The team shipped two features and a fix.'

    // Should be accepted as Pending
    const acceptedResult = validateResponseSpan(
      documentText,
      selectedStart,
      selectedEnd,
      inSpanResponse,
    )

    if (acceptedResult.kind !== 'accepted') {
      throw new Error(`expected an in-span response to be accepted, got ${acceptedResult.kind}`)
    }
    expect(acceptedResult.accepted).toBe(true)
    expect(acceptedResult.pending).toBeDefined()
    expect(acceptedResult.pending.proposal).toBe(inSpanResponse)
  })

  it('T-FR-6-19: A response identical to the selected text is neither accepted nor declined', () => {
    const documentText = 'Sales rose in Q1. The team shipped two features.'
    const selectedStart = 19
    const selectedEnd = 49
    const selectedText = documentText.slice(selectedStart, selectedEnd)

    const result = validateResponseSpan(documentText, selectedStart, selectedEnd, selectedText)

    expect(result.kind).toBe('unchanged')
    expect(result.accepted).toBe(false)
    expect(result.documentText).toBe(documentText)

    // Padding whitespace around an otherwise-identical response still counts
    // as unchanged - the model echoing the span back verbatim, plus stray
    // whitespace, is not a proposal worth reviewing.
    const paddedResult = validateResponseSpan(
      documentText,
      selectedStart,
      selectedEnd,
      `  ${selectedText}\n`,
    )
    expect(paddedResult.kind).toBe('unchanged')
  })
})
