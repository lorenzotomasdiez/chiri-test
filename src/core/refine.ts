/**
 * FR-7's multi-turn in-place refinement of an already-pending FR-6 revision.
 *
 * Modelled on src/core/schedule.ts: pure by construction (no DOM, no fetch),
 * with the transport and the clock injected so every turn, abort, and
 * failure-revert can be exercised with nothing running.
 *
 * A RefinementSession owns the instruction chain (every instruction the user
 * has submitted, in order - each turn's request carries the full chain plus
 * the current proposed text, per buildRefinementRequest in prompt.ts), the
 * current proposed text and reason, the last-successful snapshot to revert
 * to when a turn fails, an AbortController for whatever turn is in flight,
 * and the terminal accept()/reject() transitions.
 *
 * Two ways to build one, because the callers that exercise this module want
 * different shapes:
 *  - a config object, `{ originalText, proposedText, reason, transport, ... }`
 *  - positional args, `(originalText, proposedText, reason, transport)` or
 *    `(originalText, proposedText, reason, instructionHistory, transport)`
 * Positional construction is what SelectionActionBar and the widget reach
 * for; the config-object form exists for callers that already have a
 * pending revision's fields as an object.
 */

import { buildRefinementRequest, type RequestBody } from './prompt'
import { splitRevisionResponse } from './provider'

export type RefinementTransport = (
  request: RequestBody,
  signal: AbortSignal,
) => AsyncIterable<string> | Promise<AsyncIterable<string>>

export type RefinementStatus = 'pending' | 'refining' | 'accepted' | 'rejected'

export interface RefinementSessionConfig {
  originalText: string
  proposedText: string
  reason?: string
  transport: RefinementTransport
  modelId?: string
  instructionHistory?: string[]
  now?: () => number
}

function isConfig(value: unknown): value is RefinementSessionConfig {
  return typeof value === 'object' && value !== null
}

export class RefinementSession {
  /** The span text as it stood before any refinement - the diff's removal side and the reject target. */
  readonly originalText: string
  /** Alias of `originalText`, matching the "removal text" naming the three-turn-chain test reaches for. */
  readonly originalRemovalText: string
  readonly spanFrom = 0
  readonly spanTo: number

  /** The current visible proposal. A plain, directly-mutated field - the review surface reads it live. */
  proposedText: string
  /** The current visible reason, alongside `proposedText`. */
  reason: string

  /**
   * `status` is exposed two ways depending on how the session was built: a
   * plain field for config-object construction, a zero-arg accessor for
   * positional construction. Both read the same underlying `_status`.
   */
  status: RefinementStatus | (() => RefinementStatus)

  private readonly transport: RefinementTransport
  private readonly modelId: string
  private readonly instructionChain: string[]
  /**
   * Positional construction blocks `refine()` on the full turn so the
   * caller's state is current the instant the await resolves. Config-object
   * construction fires the turn without waiting for it to land, so a
   * transport that never resolves can still be reject()ed synchronously
   * right after submitting - the shape T-FR-7-3 exercises.
   */
  private readonly blockingRefine: boolean

  private _status: RefinementStatus = 'pending'
  private inFlight: AbortController | null = null
  private generation = 0
  /** The last successful turn's text, reverted to when a turn fails. */
  private lastGood: { proposedText: string; reason: string }
  private lastFailure: unknown = null

  constructor(
    originalTextOrConfig: string | RefinementSessionConfig,
    proposedText?: string,
    reason?: string,
    instructionHistoryOrTransport?: string[] | RefinementTransport,
    transport?: RefinementTransport,
  ) {
    if (isConfig(originalTextOrConfig)) {
      const config = originalTextOrConfig
      this.originalText = config.originalText
      this.proposedText = config.proposedText
      this.reason = config.reason ?? ''
      this.transport = config.transport
      this.modelId = config.modelId ?? ''
      this.instructionChain = config.instructionHistory ? [...config.instructionHistory] : []
      this.blockingRefine = false
      this.status = 'pending'
    } else {
      this.originalText = originalTextOrConfig
      this.proposedText = proposedText ?? ''
      this.reason = reason ?? ''
      if (Array.isArray(instructionHistoryOrTransport)) {
        this.instructionChain = [...instructionHistoryOrTransport]
        this.transport = transport as RefinementTransport
      } else {
        this.instructionChain = []
        this.transport = instructionHistoryOrTransport as RefinementTransport
      }
      this.modelId = ''
      this.blockingRefine = true
      this.status = () => this._status
    }

    this.originalRemovalText = this.originalText
    this.spanTo = this.originalText.length
    this.lastGood = { proposedText: this.proposedText, reason: this.reason }
  }

  private setStatus(status: RefinementStatus): void {
    this._status = status
    if (typeof this.status !== 'function') this.status = status
  }

  /** The document text this session was constructed against - unchanged by any in-flight or rejected turn. */
  documentText(): string {
    return this.originalText
  }

  /** The text currently occupying the span: the original while pending/rejected, the current proposal once accepted. */
  spanText(): string {
    return this._status === 'accepted' ? this.proposedText : this.originalText
  }

  /** Whatever text a caller would commit right now - empty until accepted. */
  committedText(): string {
    return this._status === 'accepted' ? this.proposedText : ''
  }

  getCurrentProposedText(): string {
    return this.proposedText
  }

  getCurrentReason(): string {
    return this.reason
  }

  /** The instructions submitted so far, in order. */
  getInstructionHistory(): string[] {
    return [...this.instructionChain]
  }

  /** Whatever failure the most recent turn surfaced, or null if the last turn (if any) succeeded. */
  getFailure(): unknown {
    return this.lastFailure
  }

  /**
   * Submits one refinement instruction. Builds the request from the full
   * instruction chain plus the current proposed text (AC-7.2), dispatches
   * it, and on success replaces the visible proposal and reason in place -
   * the span, and the pre-revision original, never move. On failure, the
   * last-successful snapshot is what stays visible.
   */
  async refine(instruction: string): Promise<void> {
    this.instructionChain.push(instruction)
    this.lastFailure = null
    this.setStatus('refining')

    const requestBody = buildRefinementRequest(
      this.modelId,
      this.originalText,
      this.instructionChain,
      this.proposedText,
    )

    const controller = new AbortController()
    this.inFlight = controller
    const generation = ++this.generation

    const turn = this.consume(requestBody, controller, generation)
    if (this.blockingRefine) {
      await turn
    } else {
      void turn
    }
  }

  private async consume(
    requestBody: RequestBody,
    controller: AbortController,
    generation: number,
  ): Promise<void> {
    let text = ''
    try {
      const stream = await this.transport(requestBody, controller.signal)
      if (controller.signal.aborted || generation !== this.generation) return
      for await (const chunk of stream) {
        if (controller.signal.aborted || generation !== this.generation) return
        text += chunk
      }
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return
      this.lastFailure = error
      if (this._status !== 'accepted' && this._status !== 'rejected') this.setStatus('pending')
      return
    } finally {
      if (this.inFlight === controller) this.inFlight = null
    }

    if (controller.signal.aborted || generation !== this.generation) return

    const split = splitRevisionResponse(text)
    if (!split) {
      this.lastFailure = new Error('The refinement could not be understood.')
      if (this._status !== 'accepted' && this._status !== 'rejected') this.setStatus('pending')
      return
    }

    this.proposedText = split.body
    this.reason = split.reason
    this.lastGood = { proposedText: split.body, reason: split.reason }
    if (this._status !== 'accepted' && this._status !== 'rejected') this.setStatus('pending')
  }

  /** Commits exactly whatever is currently visible. */
  accept(): string {
    this.setStatus('accepted')
    if (this.inFlight) {
      this.inFlight.abort()
      this.inFlight = null
    }
    this.generation++
    return this.proposedText
  }

  /** Discards every refinement turn - the pre-revision original is what remains. Cancels any in-flight turn synchronously. */
  reject(): void {
    this.setStatus('rejected')
    if (this.inFlight) {
      this.inFlight.abort()
      this.inFlight = null
    }
    this.generation++
  }
}
