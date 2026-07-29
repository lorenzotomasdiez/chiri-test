/**
 * T-FR-10-14: no continuation request is ever attempted with nothing to
 * predict from. fr-5.md's own preconditions require "a non-empty preceding
 * context" and its coverage table states "Document is empty | No
 * continuation, FR-11 cue applies instead" (AC-11.2) - this is the one
 * boundary where FR-5's eligibility gating and FR-10's dispatch actually
 * compose, per fr-10.md's own framing of this scenario.
 */

import { describe, expect, it, vi } from 'vitest'
import { isEligible } from './continuation'
import { Scheduler } from './schedule'

function fakeClock() {
  let now = 0
  const pending: Array<{ at: number; fn: () => void; handle: number }> = []
  let nextHandle = 1

  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      const handle = nextHandle++
      pending.push({ at: now + ms, fn, handle })
      return handle as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => {
      const index = pending.findIndex((p) => p.handle === (handle as unknown as number))
      if (index !== -1) pending.splice(index, 1)
    },
    advance(ms: number) {
      now += ms
      const due = pending.filter((p) => p.at <= now)
      for (const entry of due) pending.splice(pending.indexOf(entry), 1)
      for (const entry of due) entry.fn()
    },
  }
}

describe('T-FR-10-14: eligibility gating refuses an empty document', () => {
  it('a brand-new empty document with the caret at position zero is not eligible', () => {
    expect(isEligible({ text: '', cursorPos: 0, selection: null, pendingSpan: null })).toBe(false)
  })

  it('a document containing only whitespace is not eligible either', () => {
    expect(isEligible({ text: '   \n  \n', cursorPos: 3, selection: null, pendingSpan: null })).toBe(false)
  })
})

describe('T-FR-10-14: an empty document never reaches the scheduler as a dispatched request', () => {
  it('never calls transport, even after the settle threshold elapses with the caret parked at position zero', async () => {
    const clock = fakeClock()
    const transport = vi.fn()

    const scheduler = new Scheduler({
      settleMs: 600,
      transport,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    })

    // Mirrors src/editor/ghostText.ts's evaluate(): eligibility (FR-5) gates
    // whether the scheduler (FR-10) ever hears onInput at all.
    const eligible = isEligible({ text: '', cursorPos: 0, selection: null, pendingSpan: null })
    expect(eligible).toBe(false)
    if (eligible) scheduler.onInput({ docVersion: 0, cursor: 0 })
    else scheduler.onCaretMove()

    // Well over the settle threshold (T-FR-10-14 uses 2s as its example).
    clock.advance(2000)
    await Promise.resolve()
    await Promise.resolve()

    expect(transport).not.toHaveBeenCalled()
  })
})
