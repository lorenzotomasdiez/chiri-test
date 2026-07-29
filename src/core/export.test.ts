import { describe, expect, it } from 'vitest'
import { DEFAULT_FILENAME, deriveFilename, toExportText } from './export'

describe('deriveFilename', () => {
  // T-FR-9-10 (P2): an unusually long heading still produces a downloadable
  // filename, clamped well under any host filesystem's length limit.
  it('clamps an unusually long heading to a bounded filename length', () => {
    const longHeading = `# ${'Word '.repeat(60).trim()}`
    const filename = deriveFilename(longHeading)

    expect(filename.endsWith('.md')).toBe(true)
    expect(filename.length).toBeLessThanOrEqual(80 + '.md'.length)
    expect(filename).not.toBe(DEFAULT_FILENAME)
  })

  // T-FR-9-12 (P2): only the first heading drives the filename when the
  // document has several - a later heading must play no part.
  it('derives the filename from only the first heading when the document has several', () => {
    const doc = '# Draft Title\n\nSome body paragraph.\n\n## Section Two\n\nMore body text.'
    const filename = deriveFilename(doc)

    expect(filename).toBe('draft-title.md')
    expect(filename).not.toContain('section')
  })

  // T-FR-9-13 (P1): a heading that is not the document's first line does not
  // drive the filename - it falls back to the fixed default.
  it('falls back to the default filename when the heading is not on the first line', () => {
    const doc = 'Some notes before the title.\n# Actual Title'
    expect(deriveFilename(doc)).toBe(DEFAULT_FILENAME)
  })

  // T-FR-9-14 (P2): repeated export of an unchanged document is
  // deterministic across both export paths.
  it('is deterministic across repeated calls on the same unchanged document', () => {
    const doc = '# Repeatable Title\n\nBody text that never changes.'

    const firstFilename = deriveFilename(doc)
    const firstExport = toExportText(doc)
    const secondExport = toExportText(doc)
    const secondFilename = deriveFilename(doc)
    const thirdExport = toExportText(doc)

    expect(firstFilename).toBe(secondFilename)
    expect(firstExport).toBe(secondExport)
    expect(secondExport).toBe(thirdExport)
  })
})
