import type { Page } from '@playwright/test'

/** Wraps one fragment of assistant prose in the SSE frame OpenRouter sends for it. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
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
      body:
        frame(`reason: ${reason}\n`) +
        frame('--') +
        frame('sep') +
        frame('--') +
        frame(`\n${proposal}`) +
        'data: [DONE]\n\n',
    })
  })
}
