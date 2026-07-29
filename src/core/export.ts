/**
 * FR-9's pure seam: the one place that turns the document's text into what
 * Copy writes to the clipboard and what Download saves as a file, plus the
 * filename derivation for that download. Copy and Download both call
 * `toExportText` on the same document string, which is what makes the two
 * outputs byte-identical rather than merely usually-the-same.
 *
 * Kept dependency-free (no DOM, no clipboard, no anchor tags) so it is the
 * only place under src/core that vite.config.ts's Vitest include pattern can
 * reach with a pure unit test.
 */

/** The fixed name used whenever no heading can be derived (AC-9's fallback). */
export const DEFAULT_FILENAME = 'untitled.md'

/** Keeps a derived filename from growing unreasonably long. */
const MAX_SLUG_LENGTH = 80

/** Characters that are illegal (or awkward) across common filesystems. */
// eslint-disable-next-line no-control-regex -- intentionally stripping control characters
const ILLEGAL_FILENAME_CHARACTERS = /[/\\:*?"<>|\x00-\x1f\x7f]/g

/**
 * The canonical "document text -> export string" function. Both the Copy
 * handler and the Download handler call this rather than touching
 * `documentText` directly, so any future normalisation (trailing newline,
 * line-ending policy, etc.) only has to be written once for both paths to
 * pick it up identically.
 */
export function toExportText(documentText: string): string {
  return documentText
}

/**
 * Pulls the words out of the document's first line if - and only if - that
 * line is a Markdown heading (one to six leading `#`s, then whitespace, then
 * content). Anything else - no heading, an empty heading, a plain paragraph -
 * yields no words, which is the fallback's trigger.
 */
function headingWords(documentText: string): string[] | undefined {
  const firstLine = (documentText.split('\n')[0] ?? '').trim()
  const match = /^#{1,6}\s+(.*)$/.exec(firstLine)
  if (!match) return undefined

  const words = match[1].match(/[A-Za-z0-9]+/g)
  if (!words || words.length === 0) return undefined
  return words
}

/**
 * Derives a `.md` filename from the document's first-line heading, or falls
 * back to `DEFAULT_FILENAME` when there is none (no text, a plain paragraph,
 * or a heading marker with no words after it). Sanitises away `/ \ : * ? "
 * < > |` and control characters, lower-cases, joins words with `-`, and
 * clamps length so a very long heading does not produce an unusable path.
 */
export function deriveFilename(documentText: string): string {
  const words = headingWords(documentText)
  if (!words) return DEFAULT_FILENAME

  const slug = words
    .join('-')
    .toLowerCase()
    .replace(ILLEGAL_FILENAME_CHARACTERS, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^[-.\s]+|[-.\s]+$/g, '')

  if (!slug) return DEFAULT_FILENAME
  return `${slug}.md`
}
