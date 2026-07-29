/**
 * FR-6's revision reducer: the pure guards a selection-triggered revision
 * must pass on its way in (paragraph-count) and on its way back
 * (out-of-span containment). Pure by construction, like every other module
 * under src/core - no DOM, no fetch, enforced by the oxlint
 * no-restricted-imports override scoped to src/core/**.
 *
 * The lifecycle itself (Idle -> Requested -> Pending -> Refining -> Accepted
 * | Rejected | Invalidated | Failed) is carried by the values these guards
 * produce plus the CM6 pending-span StateField in src/editor/, rather than
 * a single dispatched reducer function - the span's own tracking through
 * transactions *is* the Pending/Invalidated transition (AC-6.11, AC-6.12).
 */

/** AC-6.10's boundary: three paragraphs proceed, four are refused outright. */
const PARAGRAPH_LIMIT = 3

const PARAGRAPH_LIMIT_MESSAGE =
  'That selection spans more than three paragraphs. Select a smaller range and try again.'

/**
 * A gross-runaway backstop only. This used to be the whole of the AC-6.9
 * check at 1.1x + 15, which is not a containment check at all: it declined
 * legitimate rewrites that happened to run long and accepted out-of-span
 * rewrites that happened to run short. The real check is
 * `mentionsTextOutsideSpan` below; this bound now only catches a response
 * that has plainly run away (a whole essay back for a one-line span).
 */
const MAX_RESPONSE_RATIO = 3
const MAX_RESPONSE_SLACK = 80

/**
 * Function words carry no evidence about which part of the document a
 * response came from - "the" appearing both outside the span and in the
 * response says nothing - so they are excluded from the containment check
 * to keep it from declining every revision. Content words, names, and
 * figures are what actually mark text as belonging to the surrounding
 * context rather than the span.
 */
const CONTAINMENT_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'did', 'do', 'for',
  'from', 'had', 'has', 'have', 'he', 'her', 'his', 'i', 'if', 'in', 'is', 'it', 'its', 'me',
  'no', 'not', 'of', 'on', 'or', 'our', 'she', 'so', 'that', 'the', 'their', 'them', 'then',
  'there', 'they', 'this', 'to', 'up', 'was', 'we', 'were', 'what', 'when', 'which', 'who',
  'will', 'with', 'would', 'you', 'your',
])

/** Lowercased content-word tokens, Unicode-aware so non-English prose tokenizes too. */
function contentTokens(text: string): Set<string> {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return new Set(matches.filter((token) => !CONTAINMENT_STOPWORDS.has(token)))
}

/**
 * The actual AC-6.9 test: does the response carry content words that belong
 * to the document *outside* the marked span and are absent from the span
 * itself? That is what a response which also rewrote the neighbouring
 * sentence looks like - it drags the neighbour's subject matter in with it,
 * whether it echoed the neighbour verbatim or paraphrased it.
 *
 * Tokens shared with the span are exempt: a rewrite is expected to reuse
 * the span's own words, and those words may well appear elsewhere in the
 * document too.
 */
function mentionsTextOutsideSpan(
  documentText: string,
  from: number,
  to: number,
  response: string,
): boolean {
  const spanTokens = contentTokens(documentText.slice(from, to))
  const outsideTokens = contentTokens(`${documentText.slice(0, from)}\n${documentText.slice(to)}`)

  for (const token of contentTokens(response)) {
    if (outsideTokens.has(token) && !spanTokens.has(token)) return true
  }
  return false
}

let revisionCounter = 0

function nextRevisionId(): string {
  revisionCounter += 1
  return `revision-${revisionCounter}`
}

/** A revision proposal tracked by the CM6 pending-span field. */
export interface Revision {
  id: string
  /** The mapped span start, tracked (not stored as a stale numeric offset) by the pending-span StateField. */
  from: number
  /** The mapped span end. */
  to: number
  /** The model's proposed replacement for [from, to). */
  proposed: string
  /** Alias of `proposed`, for callers that reach for the revision's replacement text under that name. */
  proposal?: string
  status: 'pending' | 'accepted' | 'rejected' | 'invalidated' | 'refining'
  /** The text at [from, to) when the revision was requested, for the review surface. */
  existing?: string
  /** The model's stated reason, opaque free text (PRD Q6-a leaves the taxonomy open). */
  reason?: string
  /** The model id in effect when this revision was dispatched - never re-read live (FR-8). */
  modelId?: string
  /** FR-7: every refinement instruction submitted so far, in order - carried forward so the next turn's request sees the full chain (AC-7.2). */
  instructionHistory?: string[]
}

export interface ParagraphCheckAccepted {
  kind: 'accepted'
}

export interface ParagraphCheckRefused {
  kind: 'refused'
  message: string
  requestBody?: undefined
}

export type ParagraphCheckResult = ParagraphCheckAccepted | ParagraphCheckRefused

function countParagraphs(text: string): number {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0).length
}

/**
 * The paragraph-count guard on the Requested transition (AC-6.10). Refuses
 * outright with a visible message rather than silently clamping to the
 * limit - a silent clamp would still look plausible in a quick manual
 * check, which is exactly what the test plan calls out as the likely bug.
 */
export function checkParagraphCount(selectedText: string): ParagraphCheckResult {
  if (countParagraphs(selectedText) > PARAGRAPH_LIMIT) {
    return { kind: 'refused', message: PARAGRAPH_LIMIT_MESSAGE, requestBody: undefined }
  }
  return { kind: 'accepted' }
}

export interface SpanValidationDeclined {
  kind: 'declined'
  accepted: false
  documentText: string
}

export interface SpanValidationAccepted {
  kind: 'accepted'
  accepted: true
  documentText: string
  pending: Revision
}

export type SpanValidationResult = SpanValidationDeclined | SpanValidationAccepted

/**
 * The out-of-span containment check (AC-6.9): a response that reads as a
 * rewrite of more than the marked span is discarded entirely rather than
 * silently narrowed to the span alone, matching AC-6.9's "declined, not
 * narrowed" contract.
 */
export function validateResponseSpan(
  documentText: string,
  from: number,
  to: number,
  response: string,
): SpanValidationResult {
  const selectedText = documentText.slice(from, to)
  const trimmedResponse = response.trim()
  const budget = selectedText.length * MAX_RESPONSE_RATIO + MAX_RESPONSE_SLACK

  if (mentionsTextOutsideSpan(documentText, from, to, trimmedResponse)) {
    return { kind: 'declined', accepted: false, documentText }
  }

  if (trimmedResponse.length > budget) {
    return { kind: 'declined', accepted: false, documentText }
  }

  return {
    kind: 'accepted',
    accepted: true,
    documentText,
    pending: {
      id: nextRevisionId(),
      from,
      to,
      proposed: trimmedResponse,
      proposal: trimmedResponse,
      status: 'pending',
      existing: selectedText,
    },
  }
}

/**
 * FR-8/AC-6's model-snapshot rule for a refinement turn: the model id
 * captured on the revision when it was first dispatched wins over whatever
 * is currently selected, so a model change while a revision is pending never
 * retargets an in-flight or later refinement turn (T-FR-8-4).
 */
export function resolveRefinementModelId(
  revision: Pick<Revision, 'modelId'>,
  currentModelId: string,
): string {
  return revision.modelId ?? currentModelId
}
