import { describe, it, expect } from 'vitest'
import { splitRevisionResponse } from './provider'

/**
 * T-FR-6-22 / AC-12.6: `splitRevisionResponse` is the module the PRD names as
 * responsible for treating a malformed revision response as a failed request
 * rather than rendering something garbled. Every prior test only exercises
 * the well-formed path (reason, sentinel, body all present); none pins the
 * three malformed shapes the doc comment above the function claims to
 * handle - so a change that broke any one of them (e.g. returning an empty
 * string instead of undefined) would pass the whole suite today.
 */
describe('splitRevisionResponse: malformed shapes', () => {
  it('returns undefined when the sentinel line is missing entirely', () => {
    expect(splitRevisionResponse('Here is a rewrite for you, hope it helps!')).toBeUndefined()
  })

  it('returns undefined when nothing follows the sentinel', () => {
    expect(splitRevisionResponse('reason: Softens the blame.\n--sep--\n')).toBeUndefined()
    expect(splitRevisionResponse('reason: Softens the blame.\n--sep--   ')).toBeUndefined()
  })

  it('returns undefined when nothing precedes the sentinel', () => {
    expect(splitRevisionResponse('--sep--\nthe team was stretched thin')).toBeUndefined()
  })

  it('returns undefined when the reason line is present but blank', () => {
    expect(splitRevisionResponse('reason:   \n--sep--\nthe team was stretched thin')).toBeUndefined()
  })

  it('returns undefined for an entirely empty response', () => {
    expect(splitRevisionResponse('')).toBeUndefined()
  })
})
