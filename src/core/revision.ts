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
 * A response whose length blows well past what a same-span rewrite would
 * plausibly need is treated as having rewritten more than the marked span
 * (AC-6.9) - a cheap, dependency-free proxy for "the model also rewrote the
 * surrounding context", which is what a response including out-of-span
 * material actually looks like: longer than a same-span rewrite has any
 * reason to be.
 */
const MAX_RESPONSE_RATIO = 1.1
const MAX_RESPONSE_SLACK = 15

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
  /** Alias of `proposed`, matching `PendingRevision`'s field name in prompt.ts for callers that reach for it under that name. */
  proposal?: string
  status: 'pending' | 'accepted' | 'rejected' | 'invalidated' | 'refining'
  /** The text at [from, to) when the revision was requested, for the review surface. */
  existing?: string
  /** The model's stated reason, opaque free text (PRD Q6-a leaves the taxonomy open). */
  reason?: string
  /** The model id in effect when this revision was dispatched - never re-read live (FR-8). */
  modelId?: string
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
