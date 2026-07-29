/**
 * Request assembly - FR-8's request-routing half plus the request contract
 * documented at docs/tech/chiri/index.md "The request contract".
 *
 * Pure string in, request body out: no store, no settings object, no fetch.
 * The model id in effect is always passed in explicitly by the caller
 * (src/core/schedule.ts snapshots it at dispatch time), never read live from
 * here, which is what keeps a mid-flight model change from retargeting a
 * request that has already been assembled.
 */

/** The window of preceding-context text sent for a continuation request. */
const CONTINUATION_CONTEXT_CHARS = 2000

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface RequestBody {
  model: string
  max_tokens: number
  temperature: number
  stream: boolean
  messages: ChatMessage[]
}

const CONTINUATION_SYSTEM_MESSAGE =
  'Continue the text with at most two sentences. No preamble, no quoting, and never restate text already present.'

/**
 * The sentinel the model is asked to emit between its reason and the
 * rewritten span, and the exact string `splitRevisionResponse` in
 * src/core/provider.ts looks for. It is named here rather than merely
 * alluded to: a system message that says "then the sentinel line" without
 * saying what the sentinel is asks the model to guess a token it has no way
 * to know, and every real response then fails to parse. Keep this in sync
 * with `REVISION_SENTINEL` in provider.ts.
 */
const REVISION_SENTINEL = '--sep--'

const REVISION_SYSTEM_MESSAGE =
  'Rewrite only the marked span. Reply with the reason on its own line, then a line containing exactly ' +
  REVISION_SENTINEL +
  ', then the rewritten span and nothing else. Do not repeat the reason after the separator, do not wrap the rewritten span in quotes, and never include text from outside the span.'

/**
 * Trims preceding context forward to the nearest paragraph break, so the
 * prompt sent to the model never starts mid-sentence.
 */
function trimToParagraphBreak(context: string): string {
  const breakIndex = context.indexOf('\n\n')
  if (breakIndex === -1) return context
  return context.slice(breakIndex + 2)
}

function precedingContext(documentText: string, cursorPosition: number): string {
  const start = Math.max(0, cursorPosition - CONTINUATION_CONTEXT_CHARS)
  const window = documentText.slice(start, cursorPosition)
  return start > 0 ? trimToParagraphBreak(window) : window
}

/** Assembles a continuation request body for the given model. */
export function buildContinuationRequest(
  modelId: string,
  documentText: string,
  cursorPosition: number,
): RequestBody {
  const context = precedingContext(documentText, cursorPosition)
  return {
    model: modelId,
    max_tokens: 120,
    temperature: 0.4,
    stream: true,
    messages: [
      { role: 'system', content: CONTINUATION_SYSTEM_MESSAGE },
      { role: 'user', content: context },
    ],
  }
}

/**
 * Convenience wrapper over `buildContinuationRequest` for callers that only
 * have the document text and the caret implicitly at its end.
 */
export function assembleContinuationRequest(documentText: string, modelId: string): RequestBody {
  return buildContinuationRequest(modelId, documentText, documentText.length)
}

/** Assembles a revision request body for the given model and selected span. */
export function buildRevisionRequest(modelId: string, selectedText: string): RequestBody {
  return {
    model: modelId,
    max_tokens: 400,
    temperature: 0.2,
    // Streamed, like continuations. The response therefore arrives as
    // text/event-stream and must go through `decodeCompletionStream` in
    // src/core/provider.ts before any parsing: the model's prose is spread
    // across `delta.content` fragments, and the reason/sentinel splitter
    // reads meaningless bytes if pointed at the raw SSE transcript.
    stream: true,
    messages: [
      { role: 'system', content: REVISION_SYSTEM_MESSAGE },
      { role: 'user', content: selectedText },
    ],
  }
}

/**
 * Assembles an FR-7 refinement request: the same system message and
 * sentinel contract as `buildRevisionRequest` (so `splitRevisionResponse`
 * parses either response identically), but the user message carries the
 * full ordered instruction chain plus the current proposed text rather than
 * just the selected span - the load-bearing detail AC-7.2 hangs on, since a
 * turn that only saw its own instruction would forget everything the user
 * asked for earlier in the same refinement.
 */
export function buildRefinementRequest(
  modelId: string,
  originalText: string,
  instructions: string[],
  currentProposedText: string,
): RequestBody {
  const instructionLines = instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')
  const userMessage = [
    `Original span:\n${originalText}`,
    `Current proposed rewrite:\n${currentProposedText}`,
    `Instructions so far, in order:\n${instructionLines}`,
  ].join('\n\n')

  return {
    model: modelId,
    max_tokens: 400,
    temperature: 0.2,
    // Streamed, like `buildRevisionRequest` - see the note there on why the
    // response must go through `decodeCompletionStream` before parsing.
    stream: true,
    messages: [
      { role: 'system', content: REVISION_SYSTEM_MESSAGE },
      { role: 'user', content: userMessage },
    ],
  }
}

/**
 * A revision proposal, holding the model id in effect when it was dispatched
 * rather than re-reading the live selection. A model change while a
 * revision is pending must never retarget or mutate it (FR-8, FR-6).
 */
export class PendingRevision {
  readonly modelId: string
  readonly proposal: string

  constructor(modelId: string, proposal: string) {
    this.modelId = modelId
    this.proposal = proposal
  }

  /** Commits the proposal exactly as dispatched, regardless of later model changes. */
  accept(): string {
    return this.proposal
  }
}
