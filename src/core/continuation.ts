/**
 * FR-5's pure core: eligibility for offering an inline continuation, plus the
 * shaping a raw model response needs before it can be shown as a ghost.
 *
 * Pure by construction, like every other module under src/core - no DOM, no
 * fetch, no @codemirror import, enforced by the oxlint no-restricted-imports
 * override scoped to src/core/**. Everything here operates on a plain
 * `{ text, cursorPos, selection }` shape rather than editor state, so
 * src/editor/ghostText.ts is the only place that ever touches CodeMirror.
 */

export interface Selection {
  from: number
  to: number
}

export interface PendingSpan {
  from: number
  to: number
}

export interface EligibilityInput {
  /** The whole document, as CodeMirror holds it. */
  text: string
  /** The caret offset a continuation would be requested for. */
  cursorPos: number
  /** The current selection, or null/undefined when the caret is a plain cursor. */
  selection?: Selection | null
  /** FR-6's pending revision span, if one is open - eligibility refuses inside it (AC-5.11). */
  pendingSpan?: PendingSpan | null
}

const FENCE = '```'

/** True when `pos` falls inside an unterminated fenced code block. */
function insideFencedCodeBlock(text: string, pos: number): boolean {
  const before = text.slice(0, pos)
  let count = 0
  let index = before.indexOf(FENCE)
  while (index !== -1) {
    count++
    index = before.indexOf(FENCE, index + FENCE.length)
  }
  return count % 2 === 1
}

/** True when the text up to the caret, on the current line, is inside an unterminated `](...)` link target. */
function insideLinkTarget(lineBeforeCursor: string): boolean {
  const openIndex = lineBeforeCursor.lastIndexOf('](')
  if (openIndex === -1) return false
  const closeIndex = lineBeforeCursor.indexOf(')', openIndex + 2)
  return closeIndex === -1
}

/**
 * True when `pos` sits at the end of a paragraph or list item: nothing but
 * whitespace follows on the current line, and what follows the line (if
 * anything) is a paragraph break or the end of the document rather than a
 * wrapped continuation of the same paragraph. This is what rules out
 * mid-word and mid-line positions without a separate check - a caret with
 * more of the same word or line ahead of it never satisfies it.
 */
function isAtEligibleLineEnd(text: string, pos: number): boolean {
  const nextNewline = text.indexOf('\n', pos)
  const lineEnd = nextNewline === -1 ? text.length : nextNewline
  if (text.slice(pos, lineEnd).trim() !== '') return false

  if (nextNewline === -1) return true

  const afterNewline = nextNewline + 1
  if (afterNewline >= text.length) return true

  const followingNewline = text.indexOf('\n', afterNewline)
  const followingLineEnd = followingNewline === -1 ? text.length : followingNewline
  const followingLine = text.slice(afterNewline, followingLineEnd)
  return followingLine.trim() === ''
}

/**
 * Refuses to fire while a selection is non-empty, while inside a fenced code
 * block, mid-word, inside a link target, or inside a pending revision span
 * (AC-5.11) - and otherwise requires the caret to sit at the end of a
 * paragraph or list item.
 */
export function isEligible(input: EligibilityInput): boolean {
  const { text, cursorPos, selection, pendingSpan } = input

  if (selection && selection.from !== selection.to) return false
  if (pendingSpan && cursorPos >= pendingSpan.from && cursorPos <= pendingSpan.to) return false
  if (insideFencedCodeBlock(text, cursorPos)) return false

  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1
  if (insideLinkTarget(text.slice(lineStart, cursorPos))) return false

  return isAtEligibleLineEnd(text, cursorPos)
}

/**
 * Splits ghost text into the next word - leading whitespace plus the
 * following run of non-whitespace characters - and everything after it, for
 * the accept-next-word keybinding. Returns null for text with no more words
 * (whitespace only, or empty).
 */
export function extractNextWord(text: string): { word: string; rest: string } | null {
  const match = /^\s*\S+/.exec(text)
  if (!match) return null
  return { word: match[0], rest: text.slice(match[0].length) }
}

/** Common ways a model prefaces a continuation instead of just writing it. */
const PREAMBLE_PATTERNS = [
  /^\s*sure[,!]?\s*/i,
  /^\s*okay[,!]?\s*/i,
  /^\s*certainly[,!]?\s*/i,
  /^\s*here('?s| is)[^:\n]*:\s*/i,
  /^\s*continuation:\s*/i,
]

/** Strips a leading preamble line the system message told the model not to send. */
export function stripPreamble(text: string): string {
  let result = text
  for (const pattern of PREAMBLE_PATTERNS) {
    const stripped = result.replace(pattern, '')
    if (stripped !== result) {
      result = stripped
      break
    }
  }
  return result
}

/** Strips a wrapping pair of quote marks around the whole continuation, if present. */
export function stripQuotes(text: string): string {
  const trimmed = text.trim()
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
  ]
  for (const [open, close] of pairs) {
    if (trimmed.length >= 2 && trimmed.startsWith(open) && trimmed.endsWith(close)) {
      const leading = text.slice(0, text.indexOf(trimmed))
      return leading + trimmed.slice(open.length, trimmed.length - close.length)
    }
  }
  return text
}

/**
 * Cuts a continuation down to at most two sentences, ending on a sentence
 * boundary (a `.`, `!`, or `?` followed by whitespace or the end of the
 * string).
 *
 * Two separate cuts happen here, and AC-5.10 asks for both. The obvious one
 * is the ceiling: a third sentence is dropped. The other is the dangling
 * fragment - a model that stops mid-thought leaves `Turn left at the fork.
 * Then follow the creek until`, and showing that half-thought offers the
 * writer something no one finished writing. Whatever follows the last
 * complete boundary goes, so the offer always ends somewhere a sentence
 * actually ended.
 *
 * Text with no boundary at all is returned whole rather than cut to nothing:
 * a single unfinished clause is all the model returned, and suppressing every
 * such response would mean this case can never offer anything.
 *
 * The leading space a continuation arrives with is significant - it is what
 * lets the text be appended straight onto the document with nothing missing -
 * and is never trimmed here.
 */
export function truncateToTwoSentences(text: string): string {
  const boundary = /[.!?]+(?=\s|$)/g
  let match: RegExpExecArray | null
  let count = 0
  let lastBoundaryEnd = -1
  while ((match = boundary.exec(text)) !== null) {
    count++
    lastBoundaryEnd = match.index + match[0].length
    if (count === 2) break
  }
  if (lastBoundaryEnd === -1) return text
  return text.slice(0, lastBoundaryEnd)
}

/**
 * Drops the leading part of a continuation that just repeats the tail of
 * what precedes the caret, so a model that echoes a little context back
 * does not duplicate it in the document once accepted.
 */
export function suppressDuplicateTail(precedingContext: string, continuation: string): string {
  const context = precedingContext
  const maxOverlap = Math.min(context.length, continuation.length)
  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const contextTail = context.slice(context.length - overlap).toLowerCase()
    const continuationHead = continuation.slice(0, overlap).toLowerCase()
    if (contextTail === continuationHead) return continuation.slice(overlap)
  }
  return continuation
}

/** True when text is empty or made up only of whitespace. */
export function isBlank(text: string): boolean {
  return text.trim().length === 0
}

/**
 * The full shaping pipeline a raw streamed continuation goes through before
 * it is fit to show as a ghost: preamble and quote stripping, then the
 * two-sentence cut. Returns '' for a response that sanitizes down to nothing,
 * which callers treat as "no continuation to show".
 */
export function sanitizeContinuation(raw: string): string {
  if (isBlank(raw)) return ''
  let text = stripPreamble(raw)
  text = stripQuotes(text)
  text = truncateToTwoSentences(text)
  return isBlank(text) ? '' : text
}
