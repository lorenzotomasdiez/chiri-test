import type { ProbeTransport } from '../core/keygate'

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
