import { describe, expect, it } from 'vitest'
import { isBlank, sanitizeContinuation } from './continuation'

/**
 * AC-12.1 from FR-5's side: a response with nothing in it is not an error
 * condition to report, it is simply nothing to show. The writer never learns
 * a request was made.
 */
describe('T-FR-5-19: an empty or whitespace-only response shows nothing and no error', () => {
  it('sanitizes an empty response to nothing', () => {
    expect(sanitizeContinuation('')).toBe('')
  })

  it('sanitizes a spaces-and-newlines response to nothing', () => {
    expect(sanitizeContinuation('   \n\n  \t ')).toBe('')
  })

  it('sanitizes a response that is only a preamble to nothing', () => {
    // "Sure!" with nothing after it is a response that says nothing. Stripping
    // the preamble has to leave the empty string, not the preamble itself.
    expect(sanitizeContinuation('Sure!')).toBe('')
  })

  it('sanitizes a response that is only empty quotes to nothing', () => {
    expect(sanitizeContinuation('""')).toBe('')
  })

  it('never throws on a blank response', () => {
    expect(() => sanitizeContinuation('')).not.toThrow()
    expect(() => sanitizeContinuation('\n')).not.toThrow()
  })

  it('recognises blank text for what it is', () => {
    expect(isBlank('')).toBe(true)
    expect(isBlank('   \n\t')).toBe(true)
    expect(isBlank(' a ')).toBe(false)
  })

  it('still passes a real continuation through', () => {
    expect(sanitizeContinuation(' the pot for coffee.')).toBe(' the pot for coffee.')
  })
})
