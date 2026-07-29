/**
 * Continuation request discipline - FR-10 in full.
 *
 * Pure by construction: no DOM, no fetch, no CodeMirror. The clock and the
 * transport are injected, so every debounce, ceiling, and staleness assertion
 * runs in virtual time with nothing running.
 */

export interface InputSignal {
  /** Monotonic document version. Only used to tell one edit from the next. */
  docVersion: number
  /** Caret offset the request would be made for. */
  cursor: number
}

/**
 * What actually goes out to the transport: the input signal plus the model
 * id in effect at dispatch time (FR-8). Snapshotted once, in `issue()`, so a
 * selection change after dispatch never retargets a request already in flight.
 */
export interface DispatchedRequest extends InputSignal {
  modelId?: string
}

export type Transport = (
  req: DispatchedRequest,
  signal: AbortSignal,
) => AsyncIterable<string> | Promise<AsyncIterable<string>>

export interface SchedulerOptions {
  /** How long input must be quiet before we speak to the model. */
  settleMs: number
  transport: Transport
  /** Ceiling on requests in any sliding minute. Exceeding it is silent (AC-10.4). */
  maxPerMinute?: number
  /** Continuation is on by default and can be turned off (AC-10.5). */
  enabled?: boolean
  /** Called once per request with the full accumulated text, if still current. */
  onResult?: (text: string) => void
  /** Called per streamed chunk, so first paint can happen before completion (NFR-1). */
  onChunk?: (textSoFar: string) => void
  /**
   * FR-12: called with whatever a request threw, for the one thing a
   * continuation failure is still allowed to do - route a rejected key back
   * to FR-1's gate (AC-12.4). Never called for a request this scheduler
   * cancelled itself, since a superseded request is not a failure
   * (T-FR-12-18), and never a reason to show the user anything: continuation
   * failures are silent by class (AC-12.1), so a caller that surfaces a
   * message from here has misread the requirement.
   */
  onFailure?: (error: unknown) => void
  /** Reads the currently selected model id, if the caller wants it snapshotted onto each dispatch. */
  modelSource?: () => string
  /** Injected for tests; defaults to the real ones. */
  now?: () => number
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void
}

export class Scheduler {
  private readonly opts: Required<
    Pick<SchedulerOptions, 'settleMs' | 'transport' | 'maxPerMinute' | 'now' | 'setTimeout' | 'clearTimeout'>
  > &
    SchedulerOptions

  private enabled: boolean
  private settleHandle: ReturnType<typeof setTimeout> | null = null
  private inFlight: AbortController | null = null
  /** Bumped by any input or caret move. A result whose generation is stale is dropped. */
  private generation = 0
  private issuedAt: number[] = []

  constructor(options: SchedulerOptions) {
    this.opts = {
      maxPerMinute: Number.POSITIVE_INFINITY,
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h),
      ...options,
    }
    this.enabled = options.enabled ?? true
  }

  /** The user typed. Cancel anything in flight and restart the settle window. */
  onInput(signal: InputSignal): void {
    this.invalidate()
    if (!this.enabled) return

    const generation = this.generation
    this.settleHandle = this.opts.setTimeout(() => {
      this.settleHandle = null
      this.issue(signal, generation)
    }, this.opts.settleMs)
  }

  /**
   * The caret moved without an edit. Anything in flight was computed for a
   * position the user has left, so it is cancelled and its result discarded -
   * a suggestion for somewhere else is worse than no suggestion (AC-10.3).
   */
  onCaretMove(): void {
    this.invalidate()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.invalidate()
  }

  /** Cancels in-flight work and pending settles without scheduling anything. */
  dispose(): void {
    this.invalidate()
  }

  private invalidate(): void {
    this.generation++
    if (this.settleHandle !== null) {
      this.opts.clearTimeout(this.settleHandle)
      this.settleHandle = null
    }
    if (this.inFlight) {
      this.inFlight.abort()
      this.inFlight = null
    }
  }

  private withinCeiling(): boolean {
    const cutoff = this.opts.now() - 60_000
    this.issuedAt = this.issuedAt.filter((t) => t > cutoff)
    return this.issuedAt.length < this.opts.maxPerMinute
  }

  private issue(signal: InputSignal, generation: number): void {
    if (generation !== this.generation) return
    // Dropping a prediction is silent: a warning about a request the user never
    // asked for is noise (FR-10).
    if (!this.withinCeiling()) return

    this.issuedAt.push(this.opts.now())
    const controller = new AbortController()
    this.inFlight = controller

    const modelId = this.opts.modelSource?.()
    const request: DispatchedRequest = modelId !== undefined ? { ...signal, modelId } : { ...signal }

    void this.consume(request, controller, generation)
  }

  private async consume(
    request: DispatchedRequest,
    controller: AbortController,
    generation: number,
  ): Promise<void> {
    let text = ''
    try {
      const stream = await this.opts.transport(request, controller.signal)
      for await (const chunk of stream) {
        if (controller.signal.aborted || generation !== this.generation) return
        text += chunk
        this.opts.onChunk?.(text)
      }
    } catch (error) {
      // Continuation failures are silent by design (FR-12, AC-12.1) - nothing
      // is shown here, ever. The failure is still reported to `onFailure`,
      // because a rejected key has to reach FR-1's gate no matter which class
      // of request found it out (AC-12.4).
      //
      // A cancelled request is excluded: the generation guard and the abort
      // flag are how FR-10's discipline retires a request the user has moved
      // past, and that is not a failure to report (T-FR-12-18).
      if (!controller.signal.aborted && generation === this.generation) {
        this.opts.onFailure?.(error)
      }
      return
    } finally {
      if (this.inFlight === controller) this.inFlight = null
    }

    if (controller.signal.aborted || generation !== this.generation) return
    if (text.length > 0) this.opts.onResult?.(text)
  }
}
