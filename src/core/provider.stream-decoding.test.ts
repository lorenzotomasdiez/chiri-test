import { describe, it, expect } from 'vitest'
import {
  createCompletionStreamDecoder,
  decodeCompletionStream,
  splitRevisionResponse,
} from './provider'

/**
 * The regression these pin: revision and continuation requests both set
 * `stream: true`, so the response body is an SSE transcript, but nothing
 * decoded it - `requestRevisionCompletion`'s raw body went straight into
 * `splitRevisionResponse`. Every real revision failed to parse while the
 * e2e mocks passed, because the mocks served bare prose with the sentinel
 * already in it: shaped to the parser instead of to the protocol.
 */

/** Builds an SSE transcript that delivers `fragments` one frame at a time. */
function stream(fragments: string[]): string {
  const frames = fragments.map(
    (content) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`,
  )
  return `${frames.join('')}data: [DONE]\n\n`
}

describe('decodeCompletionStream', () => {
  it('reassembles prose spread across delta frames', () => {
    expect(decodeCompletionStream(stream(['Hola', ', madre', '. ¿Cómo estás?']))).toBe(
      'Hola, madre. ¿Cómo estás?',
    )
  })

  it('finds a sentinel that arrived split across frames', () => {
    // The subtler half of the bug: scanning the raw transcript for '--sep--'
    // cannot find it when the model streams it as three separate tokens.
    const raw = stream(['reason: Softens the blame.\n', '--', 'sep', '--', '\nthe team was stretched thin'])

    const decoded = decodeCompletionStream(raw)
    expect(decoded).toBeDefined()
    expect(splitRevisionResponse(decoded!)).toEqual({
      reason: 'Softens the blame.',
      body: 'the team was stretched thin',
    })

    // ...and the same content is unparseable without decoding first, which
    // is exactly what shipped.
    expect(splitRevisionResponse(raw)?.body).not.toBe('the team was stretched thin')
  })

  it('ignores the [DONE] terminator and blank lines', () => {
    expect(decodeCompletionStream('data: [DONE]\n\n')).toBeUndefined()
    expect(decodeCompletionStream(stream(['done']))).toBe('done')
  })

  it('skips unreadable frames rather than discarding prose that did arrive', () => {
    const raw = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'kept' } }] })}`,
      'data: {not json',
      ': an SSE comment line',
      `data: ${JSON.stringify({ choices: [{ delta: { content: ' and kept' } }] })}`,
      'data: [DONE]',
    ].join('\n\n')

    expect(decodeCompletionStream(raw)).toBe('kept and kept')
  })

  it('tolerates CRLF line endings', () => {
    expect(decodeCompletionStream(stream(['ok']).replace(/\n/g, '\r\n'))).toBe('ok')
  })

  it('also reads a non-streamed message.content body, so flipping stream does not silently break parsing', () => {
    const nonStreamed = `data: ${JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'plain completion' } }],
    })}`
    expect(decodeCompletionStream(nonStreamed)).toBe('plain completion')
  })

  it('treats a body with no usable frames as malformed', () => {
    expect(decodeCompletionStream('not an event stream at all')).toBeUndefined()
    expect(decodeCompletionStream('')).toBeUndefined()
    expect(decodeCompletionStream(stream(['   ']))).toBeUndefined()
  })
})

/**
 * The incremental path, used by `requestRevisionCompletion` reading
 * `response.body`. A network chunk boundary has nothing to do with an SSE
 * frame boundary, so these feed the same transcript in deliberately awful
 * splits and assert the decoded prose is identical every time.
 */
describe('createCompletionStreamDecoder', () => {
  /** Feeds `raw` in slices of `size` and returns everything decoded. */
  function pushInSlices(raw: string, size: number): string {
    const decoder = createCompletionStreamDecoder()
    let out = ''
    for (let i = 0; i < raw.length; i += size) {
      out += decoder.push(raw.slice(i, i + size))
    }
    return out + decoder.flush()
  }

  const raw = stream(['Hola', ', madre', '. ¿Cómo estás?'])

  it('decodes identically at every chunk size, including one byte at a time', () => {
    for (const size of [1, 2, 3, 7, 13, 64, 4096]) {
      expect(pushInSlices(raw, size)).toBe('Hola, madre. ¿Cómo estás?')
    }
  })

  it('holds back a frame split mid-JSON until the rest arrives', () => {
    const decoder = createCompletionStreamDecoder()

    // A read that ends in the middle of the JSON payload must emit nothing
    // rather than trying to parse the fragment.
    expect(decoder.push('data: {"choices":[{"delta":{"cont')).toBe('')
    expect(decoder.push('ent":"recovered"}}]}\n\n')).toBe('recovered')
  })

  it('emits each frame as it completes, not all at the end', () => {
    const decoder = createCompletionStreamDecoder()
    const emitted: string[] = []

    for (const fragment of ['one ', 'two ', 'three']) {
      const out = decoder.push(
        `data: ${JSON.stringify({ choices: [{ delta: { content: fragment } }] })}\n\n`,
      )
      if (out) emitted.push(out)
    }

    expect(emitted).toEqual(['one ', 'two ', 'three'])
  })

  it('decodes a final frame that arrived without a trailing blank line', () => {
    const decoder = createCompletionStreamDecoder()
    expect(decoder.push('data: {"choices":[{"delta":{"content":"tail"}}]}')).toBe('')
    expect(decoder.flush()).toBe('tail')
  })

  it('reassembles a sentinel split across both frames and chunks', () => {
    const split = stream(['reason: Warmer.\n', '--', 'sep', '--', '\nHola, mamá'])
    expect(splitRevisionResponse(pushInSlices(split, 3))).toEqual({
      reason: 'Warmer.',
      body: 'Hola, mamá',
    })
  })
})
