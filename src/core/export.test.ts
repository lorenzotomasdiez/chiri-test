import { describe, expect, it } from 'vitest'
import { DEFAULT_FILENAME, deriveFilename, toExportText } from './export'

describe('toExportText', () => {
  it('passes the document text through unchanged', () => {
    expect(toExportText('# Title\n\nSome body text.')).toBe('# Title\n\nSome body text.')
  })

  it('passes an empty document through unchanged', () => {
    expect(toExportText('')).toBe('')
  })
})

describe('deriveFilename', () => {
  it('slugifies a heading into a lower-case, hyphenated filename', () => {
    expect(deriveFilename('# Quarterly Report Draft')).toBe('quarterly-report-draft.md')
  })

  it('falls back to the default filename for an empty document', () => {
    expect(deriveFilename('')).toBe(DEFAULT_FILENAME)
  })

  it('falls back to the default filename when the first line is a plain paragraph', () => {
    expect(deriveFilename('Just a paragraph, no heading.')).toBe(DEFAULT_FILENAME)
  })

  it('falls back to the default filename for a heading marker with no words after it', () => {
    expect(deriveFilename('# ')).toBe(DEFAULT_FILENAME)
  })

  it('falls back to the default filename when the heading sanitizes to nothing', () => {
    expect(deriveFilename('# !!! *** ///')).toBe(DEFAULT_FILENAME)
  })

  it('strips filesystem-illegal characters while keeping readable words', () => {
    const filename = deriveFilename('# Q1/Q2 Report: "Final" <v2>')
    expect(filename).toMatch(/\.md$/)
    expect(filename).not.toMatch(/[/\\:*?"<>|]/)
    expect(filename).toContain('q1')
    expect(filename).toContain('q2')
    expect(filename).toContain('report')
    expect(filename).toContain('final')
  })

  it('strips control characters', () => {
    const filename = deriveFilename('# Hello\x00World\x1fThere')
    // eslint-disable-next-line no-control-regex -- intentionally asserting these are absent
    expect(filename).not.toMatch(/[\x00-\x1f\x7f]/)
  })

  it('clamps an overlong heading to the max slug length', () => {
    const longHeading = `# ${Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')}`
    const filename = deriveFilename(longHeading)
    const withoutExtension = filename.replace(/\.md$/, '')
    expect(withoutExtension.length).toBeLessThanOrEqual(80)
  })

  it('does not leave a leading or trailing separator after clamping or sanitizing', () => {
    const longHeading = `# ${Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')}`
    const filename = deriveFilename(longHeading)
    const withoutExtension = filename.replace(/\.md$/, '')
    expect(withoutExtension).not.toMatch(/^[-.\s]/)
    expect(withoutExtension).not.toMatch(/[-.\s]$/)
  })

  it('only considers the first line, ignoring headings later in the document', () => {
    expect(deriveFilename('Not a heading\n# Ignored Heading')).toBe(DEFAULT_FILENAME)
  })

  it('treats a level-6 heading as valid and rejects a level-7 "heading"', () => {
    expect(deriveFilename('###### Deep Heading')).toBe('deep-heading.md')
    expect(deriveFilename('####### Too Deep')).toBe(DEFAULT_FILENAME)
  })
})
