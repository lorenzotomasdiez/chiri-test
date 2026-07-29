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

/** The terminating payload OpenRouter sends as the last SSE frame. */
const STREAM_DONE = '[DONE]'

/**
 * Reassembles the model's prose from an OpenRouter `stream: true` response
 * body. Both revision and continuation requests set that flag, so the wire
 * format is text/event-stream: a run of `data: {json}` frames, each carrying
 * one fragment of the answer in `choices[0].delta.content`, terminated by
 * `data: [DONE]`.
 *
 * Nothing decoded this before, and `requestRevisionCompletion`'s raw body
 * went straight into `splitRevisionResponse`. That is why every real
 * revision failed while the e2e mocks passed: the mocks served bare prose
 * with the sentinel already in it, so they were shaped to the parser rather
 * than to the protocol. Reassembling first also fixes the subtler half of
 * the bug - a sentinel arriving split across frames ("--", "sep", "--")
 * cannot be found by scanning the transcript, but is trivially present once
 * the fragments are concatenated.
 *
 * Returns undefined when no frame yields content, so the caller surfaces
 * AC-12.6's malformed-output treatment instead of rendering JSON debris.
 */
export function decodeCompletionStream(rawBody: string): string | undefined {
  const decoder = createCompletionStreamDecoder()
  const text = decoder.push(rawBody) + decoder.flush()
  return text.trim() ? text : undefined
}

/**
 * Pulls the prose out of one complete SSE frame, or '' if it carries none.
 * `onTerminated` fires for any frame that says the provider considers the
 * response finished - the `[DONE]` payload, or a `finish_reason` on the
 * choice. Either one is enough; a proxy that drops `[DONE]` still sets the
 * latter, and treating that response as truncated would be wrong.
 */
function decodeFrame(block: string, onTerminated?: () => void): string {
  let text = ''

  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue

    const payload = trimmed.slice('data:'.length).trim()
    if (payload === STREAM_DONE) {
      onTerminated?.()
      continue
    }
    if (!payload) continue

    let frame: unknown
    try {
      frame = JSON.parse(payload)
    } catch {
      // A frame we cannot read is skipped rather than aborting the whole
      // response: OpenRouter interleaves comment and keep-alive lines, and
      // one unreadable frame should not discard prose that did arrive.
      continue
    }

    const choices = (frame as { choices?: unknown }).choices
    if (!Array.isArray(choices) || choices.length === 0) continue

    // `delta.content` is the streaming shape; `message.content` is what the
    // same endpoint returns for a non-streamed request. Accept both so a
    // caller that flips `stream` does not silently stop parsing.
    const choice = choices[0] as {
      delta?: { content?: unknown }
      message?: { content?: unknown }
      finish_reason?: unknown
    }
    // A non-streamed body carries the whole answer in `message.content` and
    // has no `[DONE]` frame at all, so its completeness has to be read off
    // the choice itself.
    if (choice.finish_reason != null || choice.message !== undefined) onTerminated?.()
    const fragment = choice.delta?.content ?? choice.message?.content
    if (typeof fragment === 'string') text += fragment
  }

  return text
}

export interface CompletionStreamDecoder {
  /** Feeds one network chunk in and returns whatever prose became complete. */
  push(chunk: string): string
  /** Decodes any trailing frame the body ended without a blank line after. */
  flush(): string
  /**
   * Whether the provider ever said the response was finished - a `[DONE]`
   * frame or a `finish_reason`. False after the last chunk means the
   * connection closed mid-response, which AC-12.6 treats as a failed request
   * rather than as a short answer: the difference between "the model wrote
   * this much" and "this much of what the model wrote arrived" is invisible
   * in the text alone, and rendering the second as if it were the first is
   * exactly the stale-partial-text bug T-FR-12-11 exists to catch.
   */
  sawTerminator(): boolean
}

/**
 * The incremental half of the decoder, for callers reading `response.body`
 * chunk by chunk rather than awaiting `response.text()`.
 *
 * It exists because a chunk boundary and an SSE frame boundary are unrelated:
 * one `reader.read()` can hand back `data: {"choi` and leave the rest for the
 * next one. Splitting each chunk on its own would corrupt every frame
 * straddling a read. So chunks accumulate in a buffer and only complete
 * frames - those terminated by a blank line - are decoded and emitted, with
 * the partial tail held back for the next push. This is the same
 * boundary problem that let `--sep--` arrive split across frames.
 */
export function createCompletionStreamDecoder(): CompletionStreamDecoder {
  let buffer = ''
  let terminated = false
  const markTerminated = () => {
    terminated = true
  }

  return {
    sawTerminator: () => terminated,

    push(chunk: string): string {
      // Normalise line endings once, on the way in, so a CRLF frame
      // separator cannot be missed by the blank-line split below.
      buffer += chunk.replace(/\r\n/g, '\n')

      let text = ''
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        text += decodeFrame(buffer.slice(0, boundary), markTerminated)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
      }
      return text
    },

    flush(): string {
      const tail = buffer
      buffer = ''
      return tail ? decodeFrame(tail, markTerminated) : ''
    },
  }
}

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
