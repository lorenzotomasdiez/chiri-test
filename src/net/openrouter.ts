import type { ProbeTransport } from '../core/keygate'
import { MalformedResponseError } from '../core/failure'
import { buildContinuationRequest, type RequestBody } from '../core/prompt'
import { createCompletionStreamDecoder } from '../core/provider'
import type { DispatchedRequest, Transport } from '../core/schedule'

/**
 * Thin fetch wrapper satisfying KeyGate's transport shape. A direct browser
 * POST with no proxy and no SDK - probe 1 in the blueprint already
 * established that OpenRouter's CORS allows this. Lives outside src/core so
 * the pure gate never imports fetch.
 *
 * Resolves on a 2xx response. Rejects with a plain { status, body } shape
 * (or whatever fetch itself throws for a network failure) for
 * src/core/provider.ts to classify.
 */
export const openRouterProbe: ProbeTransport = async (apiKey: string, signal: AbortSignal) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }),
  })

  if (response.ok) return response

  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  throw { status: response.status, body }
}

/**
 * Thin fetch wrapper for FR-6/FR-7's revision and refinement requests, the
 * same shape as `openRouterProbe` above: a direct browser POST, no proxy, no
 * SDK. Rejects with the same plain `{ status, body }` shape on a non-2xx
 * response for `classifyFailure`.
 *
 * Requests set `stream: true`, so the body arrives as text/event-stream and
 * is consumed off `response.body` chunk by chunk rather than awaited whole
 * with `response.text()`. Consuming it whole was what made the streaming
 * flag pure cost: identical wall-clock, plus an extra wire format to parse.
 * `onFragment` fires with each piece of prose as it decodes, for callers
 * that want to show progress.
 *
 * Resolves with the fully decoded completion text - already reassembled, so
 * no caller ever sees the raw SSE transcript.
 */
export async function requestRevisionCompletion(
  body: RequestBody,
  apiKey: string,
  signal?: AbortSignal,
  onFragment?: (fragment: string, soFar: string) => void,
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      errorBody = undefined
    }
    throw { status: response.status, body: errorBody }
  }

  const decoder = createCompletionStreamDecoder()
  let completion = ''

  const emit = (fragment: string) => {
    if (!fragment) return
    completion += fragment
    onFragment?.(fragment, completion)
  }

  // A body is only absent for responses that cannot have one; fall back to
  // the buffered read rather than failing the request over it.
  if (!response.body) {
    emit(decoder.push(await response.text()))
    emit(decoder.flush())
    return finishCompletion(completion, decoder.sawTerminator())
  }

  const reader = response.body.getReader()
  const textDecoder = new TextDecoder()

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      // `stream: true` on the TextDecoder keeps a multi-byte character split
      // across two network chunks from decoding as replacement characters -
      // the byte-level twin of the frame-boundary problem the SSE decoder
      // handles, and it bites hard on the accented text this app is full of.
      emit(decoder.push(textDecoder.decode(value, { stream: true })))
    }
    emit(decoder.push(textDecoder.decode()))
    emit(decoder.flush())
  } finally {
    reader.releaseLock()
  }

  return finishCompletion(completion, decoder.sawTerminator())
}

/**
 * AC-12.6's boundary between a short answer and a cut-off one. A connection
 * that closed before the provider signalled completion did not deliver a
 * response, however much prose arrived first - so the caller is handed a
 * failure rather than a partial string it would otherwise render as a
 * finished proposal (T-FR-12-11). An empty completion is the same failure by
 * a different route: nothing usable arrived.
 */
function finishCompletion(completion: string, terminated: boolean): string {
  if (!terminated) {
    throw new MalformedResponseError('The response ended before it was complete.')
  }
  if (!completion.trim()) {
    throw new MalformedResponseError('The response carried no content.')
  }
  return completion
}

/**
 * Builds the FR-10 Scheduler's `Transport` for FR-5's continuation requests -
 * the same thin fetch wrapper pattern as `requestRevisionCompletion` above,
 * but yielding decoded fragments as an async generator instead of collecting
 * them behind a callback, since that is the shape `Scheduler.consume`
 * iterates with `for await`.
 *
 * The Scheduler only ever hands its transport a `DispatchedRequest` (caret
 * offset, doc version, and the snapshotted model id) - it knows nothing
 * about document text. The document text and API key are supplied here as
 * injected accessors instead, read at request time rather than closed over
 * once, so a caller can hand in `() => viewRef.current!.state.doc.toString()`
 * before the view it reads from even exists yet.
 */
export function createContinuationTransport(options: {
  documentText: () => string
  apiKey: () => string
}): Transport {
  return async function* continuationTransport(
    request: DispatchedRequest,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    const body: RequestBody = buildContinuationRequest(
      request.modelId ?? '',
      options.documentText(),
      request.cursor,
    )

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${options.apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let errorBody: unknown
      try {
        errorBody = await response.json()
      } catch {
        errorBody = undefined
      }
      throw { status: response.status, body: errorBody }
    }

    const decoder = createCompletionStreamDecoder()

    if (!response.body) {
      const text = decoder.push(await response.text()) + decoder.flush()
      if (text) yield text
      // Same rule as the revision path: a stream that stopped before the
      // provider said it was finished is a failed request (AC-12.6), not a
      // short continuation. The Scheduler resolves that failure to silence
      // for this class, so the user still sees nothing - but a truncated
      // half-sentence is never offered as if it were a whole suggestion.
      if (!decoder.sawTerminator()) {
        throw new MalformedResponseError('The response ended before it was complete.')
      }
      return
    }

    const reader = response.body.getReader()
    const textDecoder = new TextDecoder()

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const fragment = decoder.push(textDecoder.decode(value, { stream: true }))
        if (fragment) yield fragment
      }
      const tail = decoder.push(textDecoder.decode())
      if (tail) yield tail
      const flushed = decoder.flush()
      if (flushed) yield flushed
    } finally {
      reader.releaseLock()
    }

    if (!decoder.sawTerminator()) {
      throw new MalformedResponseError('The response ended before it was complete.')
    }
  }
}
