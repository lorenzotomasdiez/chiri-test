import type { ProbeTransport } from '../core/keygate'
import type { RequestBody } from '../core/prompt'

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
 * SDK. Resolves with the raw response text for `src/core/provider.ts`'s
 * reason/sentinel/body splitter to parse, and rejects with the same plain
 * `{ status, body }` shape on a non-2xx response for `classifyFailure`.
 */
export async function requestRevisionCompletion(
  body: RequestBody,
  apiKey: string,
  signal?: AbortSignal,
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

  return response.text()
}
