/**
 * FR-12's failure classification for AI requests - the one place a thrown
 * request error becomes a decision about what the user sees.
 *
 * Pure by construction, like every other module under src/core: no DOM, no
 * fetch. The errors it classifies are the plain `{ status, body }` shapes
 * thrown by src/net/openrouter.ts, whatever `fetch` itself throws for a
 * network failure, and the `MalformedResponseError` the same layer throws
 * for a response that arrived but cannot be used.
 *
 * The split FR-12 draws is not between failure kinds, it is between request
 * classes: continuation was never asked for, so every one of its failures is
 * silent; revision and refinement were asked for, so every one of theirs is
 * visible. `routesToKeyGate` is the single exception that overrides both
 * (AC-12.4) - a rejected key is not a request failure, it is the end of the
 * session's authentication, and it goes back through FR-1's gate no matter
 * which class of request discovered it.
 */

/**
 * A response that arrived but cannot be used: an empty body, a body missing
 * the reason/sentinel structure the revision contract expects, or a stream
 * that stopped before the provider said it was finished.
 *
 * Its own class rather than a plain Error so the classifier can recognise it
 * without string-matching a message, which is what the technical blueprint's
 * "What Will Bite" table names as the way a malformed response gets swallowed
 * into a best-effort render instead of surfacing as AC-12.6's failure.
 */
export class MalformedResponseError extends Error {
  constructor(message = 'Malformed response') {
    super(message)
    this.name = 'MalformedResponseError'
  }
}

export type RequestFailureKind =
  | 'network'
  | 'rate-limit'
  | 'credit'
  | 'key-rejected'
  | 'malformed'
  | 'unknown'

export interface RequestFailure {
  kind: RequestFailureKind
  /**
   * The line shown for a requested (revision or refinement) failure. Never
   * shown for continuation, which is silent in every case.
   */
  message: string
  /**
   * AC-12.4: this failure is an authentication failure, so the app returns to
   * FR-1's key gate instead of surfacing `message`, regardless of the class of
   * request that hit it.
   */
  routesToKeyGate: boolean
}

/**
 * One line each, factual, naming the cause rather than apologising for it.
 * Each line is distinct in wording from the others, because T-FR-12-8 turns
 * on the user being able to tell credit exhaustion apart from a network
 * outage and from a rate limit - three conditions with three different
 * things for the user to do about them.
 */
const MESSAGES: Record<RequestFailureKind, string> = {
  network: 'The request did not complete: OpenRouter could not be reached.',
  'rate-limit': 'The request did not complete: OpenRouter is rate limiting requests.',
  credit: 'The request did not complete: your OpenRouter account is out of credit.',
  'key-rejected': 'That key was rejected by OpenRouter.',
  malformed: 'The request did not complete: the response was incomplete.',
  unknown: 'The request did not complete.',
}

interface ErrorShape {
  status?: number
  name?: string
  message?: string
  body?: { error?: { code?: number; message?: string } }
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const shape = error as ErrorShape
  if (typeof shape.status === 'number') return shape.status
  if (typeof shape.body?.error?.code === 'number') return shape.body.error.code
  return undefined
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return ''
  const shape = error as ErrorShape
  if (typeof shape.message === 'string') return shape.message
  if (typeof shape.body?.error?.message === 'string') return shape.body.error.message
  return ''
}

function failure(kind: RequestFailureKind): RequestFailure {
  return { kind, message: MESSAGES[kind], routesToKeyGate: kind === 'key-rejected' }
}

/**
 * True for the one "failure" that is not a failure at all: a request the app
 * itself cancelled, because the user typed again (FR-10's request discipline)
 * or rejected the revision it belonged to. `fetch` reports an aborted request
 * by rejecting with an AbortError, which is indistinguishable from a real
 * network failure unless it is named - and T-FR-12-18 turns on exactly that
 * distinction, since cancellation must not be reported even where a genuine
 * failure would be.
 */
export function isAbort(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error && typeof error === 'object' && (error as ErrorShape).name === 'AbortError') return true
  return false
}

/**
 * Classifies whatever a request threw. Never echoes the raw error, so a key
 * cannot reach the interface through an error message (NFR-3).
 *
 * 403 joins 401 in routing to the key gate: an account restricted from using
 * the API is a credential the user must replace or fix at OpenRouter, and
 * FR-1's gate is where both the message and the replacement path already
 * live. 402 is kept separate from it because credit is a condition of an
 * otherwise working key, and AC-12.5 requires the editor to stay fully usable
 * rather than blocking behind the gate.
 */
export function classifyRequestFailure(error: unknown): RequestFailure {
  if (error instanceof MalformedResponseError) return failure('malformed')

  const status = readStatus(error)
  if (status === 401 || status === 403) return failure('key-rejected')
  if (status === 402) return failure('credit')
  if (status === 429) return failure('rate-limit')

  const message = readMessage(error)
  if (/insufficient[_ ]?credit|out of credit|payment required/i.test(message)) {
    return failure('credit')
  }
  if (/rate[ _-]?limit/i.test(message)) return failure('rate-limit')

  // A TypeError is what `fetch` rejects with when the request never reached
  // a server at all - offline, DNS failure, connection refused, CORS.
  if (error instanceof TypeError) return failure('network')
  if (status === undefined && /failed to fetch|network|load failed/i.test(message)) {
    return failure('network')
  }

  if (status !== undefined) return failure('unknown')
  return failure('network')
}
