/**
 * Maps an OpenRouter probe failure - thrown by src/net/openrouter.ts's fetch
 * wrapper, or scripted directly in tests - onto the PRD's four failure
 * kinds. Pure: no fetch, no DOM, so every response shape from probe 1 can be
 * replayed with nothing running.
 */

export type FailureKind = 'rejected' | 'account' | 'incomplete' | 'unknown'

export interface Failure {
  kind: FailureKind
  message: string
}

/**
 * One line each, factual, no apology, and no instruction to try again - the
 * gate's Connect button already says that (CC-STATUS.1 and CC-STATUS.4). The
 * rejected line is the canonical instance the design system names verbatim.
 */
const MESSAGES: Record<FailureKind, string> = {
  rejected: 'That key was rejected by OpenRouter.',
  account: 'That key works, but the account has no credit or is restricted.',
  incomplete: 'The check did not complete: network error or rate limit.',
  unknown: 'The key could not be validated: unexpected response.',
}

interface ProbeErrorShape {
  status?: number
  body?: { error?: { code?: number; message?: string } }
  message?: string
}

function extractStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const e = error as ProbeErrorShape
    if (typeof e.status === 'number') return e.status
    if (typeof e.body?.error?.code === 'number') return e.body.error.code
  }
  return undefined
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const e = error as ProbeErrorShape
    if (typeof e.message === 'string') return e.message
    if (typeof e.body?.error?.message === 'string') return e.body.error.message
  }
  return ''
}

/** Classifies a thrown probe failure. Never echoes the raw error or the key (AC-1.11). */
export function classifyFailure(error: unknown): Failure {
  const status = extractStatus(error)
  const message = extractMessage(error)

  if (status === 401) return { kind: 'rejected', message: MESSAGES.rejected }
  if (status === 402 || status === 403) return { kind: 'account', message: MESSAGES.account }
  if (status === 429) return { kind: 'incomplete', message: MESSAGES.incomplete }
  if (error instanceof TypeError) return { kind: 'incomplete', message: MESSAGES.incomplete }
  if (/invalid/i.test(message)) return { kind: 'rejected', message: MESSAGES.rejected }
  return { kind: 'unknown', message: MESSAGES.unknown }
}

/**
 * FR-6/FR-7's revision and refinement responses stream as plain text in two
 * parts, per the request contract in `prompt.ts`'s REVISION_SYSTEM_MESSAGE:
 * a reason line, a sentinel line, then the proposed replacement span. This
 * is the splitter that turns that raw text back into the two parts.
 */
export interface RevisionSplit {
  reason: string
  body: string
}

/** The sentinel line the revision system message asks the model to emit between the reason and the rewritten span. */
const REVISION_SENTINEL = '--sep--'

/**
 * Splits a revision response into its reason and its proposed span. A
 * missing sentinel line, or an empty reason/body half either side of it, is
 * treated as malformed (AC-12.6) rather than guessed at - the blueprint
 * names exactly this as the failure a rushed parser swallows into the
 * reason instead of surfacing.
 */
export function splitRevisionResponse(raw: string): RevisionSplit | undefined {
  const sentinelIndex = raw.indexOf(REVISION_SENTINEL)
  if (sentinelIndex === -1) return undefined

  const reasonPart = raw.slice(0, sentinelIndex).trim()
  const body = raw.slice(sentinelIndex + REVISION_SENTINEL.length).trim()
  if (!body) return undefined

  const reasonMatch = reasonPart.match(/^reason:\s*([\s\S]*)$/i)
  const reason = (reasonMatch ? reasonMatch[1] : reasonPart).trim()
  if (!reason) return undefined

  return { reason, body }
}
