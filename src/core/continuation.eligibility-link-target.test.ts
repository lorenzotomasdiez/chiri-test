import { describe, expect, it } from 'vitest'
import { isEligible } from './continuation'

/**
 * AC-5.7's link-target row. A caret inside a half-typed URL is not a writer
 * pausing at the end of a thought; it is a writer mid-token. Offering prose
 * there would propose English inside a URL.
 */
describe('T-FR-5-21: a caret inside a link target does not trigger a continuation', () => {
  it('refuses inside an in-progress link target', () => {
    const text = 'Meet me at [the trailhead](https://exam'
    expect(isEligible({ text, cursorPos: text.length })).toBe(false)
  })

  it('refuses inside a link target even at the end of the document', () => {
    const text = '- [the map](http'
    expect(isEligible({ text, cursorPos: text.length })).toBe(false)
  })

  it('allows again once the link target is closed', () => {
    const text = 'Meet me at [the trailhead](https://example.com) and'
    expect(isEligible({ text, cursorPos: text.length })).toBe(true)
  })

  it('does not mistake a completed link earlier on the line for an open one', () => {
    const text = 'See [one](https://a.example) and [two](https://b.example), then'
    expect(isEligible({ text, cursorPos: text.length })).toBe(true)
  })

  it('does not carry an open link target across a line break', () => {
    // The unterminated `](` sits on the previous line; the caret is at the end
    // of a fresh paragraph and is a perfectly ordinary place to offer at.
    const text = 'Broken [link](https://exam\n\nA new paragraph ending in and'
    expect(isEligible({ text, cursorPos: text.length })).toBe(true)
  })
})
