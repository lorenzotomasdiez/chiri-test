import type { Page, Route } from '@playwright/test'

/** Wraps one fragment of assistant prose in the SSE frame OpenRouter sends for it. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

/** The complete, well-formed transcript for one revision or refinement result. */
export function revisionTranscript({
  reason,
  proposal,
}: {
  reason: string
  proposal: string
}): string {
  // The sentinel is deliberately split across three frames - see the note on
  // mockRevisionResponse below.
  return (
    frame(`reason: ${reason}\n`) +
    frame('--') +
    frame('sep') +
    frame('--') +
    frame(`\n${proposal}`) +
    'data: [DONE]\n\n'
  )
}

/**
 * Serves what OpenRouter actually returns for a revision request: a
 * text/event-stream transcript of `delta.content` fragments terminated by
 * `data: [DONE]`, since `buildRevisionRequest` sets `stream: true`.
 *
 * This exists because every FR-6 spec used to hand-roll a bare-prose body
 * under an event-stream content-type header - a body no provider sends. The
 * parser accepted it, so the specs went green while the feature was broken
 * in the browser. Route every revision mock through here so a spec cannot
 * pass against a response shape that does not exist.
 *
 * The sentinel is deliberately emitted as three separate frames. A real
 * model streams it token by token, and that is precisely the case a decoder
 * that scans the raw transcript instead of reassembling it will fail.
 */
export async function mockRevisionResponse(
  page: Page,
  { reason, proposal }: { reason: string; proposal: string },
): Promise<void> {
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: revisionTranscript({ reason, proposal }),
    })
  })
}

/**
 * The failure shapes FR-12 has to tell apart, each named by the condition it
 * stands for rather than by its status code, so a spec reads as the scenario
 * it is testing.
 *
 * `offline` aborts the connection the way an unreachable network does, rather
 * than returning a status - a served error page is a reachable server, which
 * is a different failure from no server at all.
 *
 * The three malformed variants are the ones the technical blueprint flags as
 * likely to be under-handled: a body with nothing in it, a body missing the
 * sentinel structure the revision contract expects, and a stream that stops
 * partway with no `[DONE]`. The last is the one that must not leave half a
 * proposal on screen as though it were a whole one.
 */
export type FailureVariant =
  | 'offline'
  | 'rate-limit'
  | 'credit'
  | 'key-rejected'
  | 'empty-body'
  | 'malformed-body'
  | 'not-sse'
  | 'stream-cut'

export async function fulfillFailure(route: Route, variant: FailureVariant): Promise<void> {
  switch (variant) {
    case 'offline':
      return route.abort('failed')
    case 'rate-limit':
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 429, message: 'Rate limit exceeded' } }),
      })
    case 'credit':
      return route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 402, message: 'Insufficient credits' } }),
      })
    case 'key-rejected':
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 401, message: 'No auth credentials found' } }),
      })
    case 'empty-body':
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: 'data: [DONE]\n\n',
      })
    case 'malformed-body':
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: frame('Here is a rewrite for you, hope it helps!') + 'data: [DONE]\n\n',
      })
    case 'not-sse':
      // A 200 that is not the wire format at all. This is the only "malformed"
      // shape that means anything to a continuation: continuation responses
      // are plain prose with no sentinel structure to be missing, so the
      // revision variant above is a perfectly valid continuation.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unexpected: 'shape', choices: 'not an array' }),
      })
    case 'stream-cut':
      // The reason line and the sentinel both arrive, so this parses - which
      // is exactly why parsing cannot be what decides completeness. What never
      // arrives is `[DONE]`.
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: frame('reason: shorter\n') + frame('--sep--\n') + frame('A shorter'),
      })
  }
}

/** Serves one failure variant to every OpenRouter request for the rest of the test. */
export async function mockFailure(page: Page, variant: FailureVariant): Promise<void> {
  await page.route('https://openrouter.ai/**', (route) => fulfillFailure(route, variant))
}
