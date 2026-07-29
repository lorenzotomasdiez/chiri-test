/**
 * FR-1's key gate - the five-state machine that blocks the editor until a
 * working OpenRouter key is on file.
 *
 * Pure by construction, the same way src/core/schedule.ts is: no DOM, no
 * fetch, no localStorage. The transport, the clock, and the settings sink
 * are injected, so every transition - single-flight submit, cancellation of
 * a stale response, the empty/whitespace guard - runs in a test with
 * nothing running. Cancellation reuses schedule.ts's discipline: an
 * AbortController per attempt plus a monotonic generation counter, so a
 * response for an attempt that was cancelled or superseded can never flip
 * state.
 */

import { classifyFailure, type Failure } from './provider'

export type KeyGateState =
  | 'blocked-empty'
  | 'validating'
  | 'unblocked'
  | 'blocked-error'
  | 'blocked-revoked'

/** The slice of Settings the gate reads and writes. Never the storage module itself (AC-1.11: core never touches localStorage). */
export interface KeyGateSettings {
  apiKey?: string
  model?: string
  continuationEnabled?: boolean
}

/**
 * Probes a candidate key against OpenRouter. Resolves on success, throws on
 * failure - classified by ./provider. The first parameter is typed loosely
 * (rather than strictly `string`) so a value typed against
 * schedule.ts's `Transport` - reusing that type's shape, per the blueprint -
 * remains assignable here even though the two transports carry different
 * payloads.
 */
export type ProbeTransport = (apiKey: any, signal: AbortSignal) => unknown

export interface KeyGateOptions {
  transport: ProbeTransport
  settings: KeyGateSettings
  now?: () => number
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
}

export class KeyGate {
  private readonly opts: Required<Pick<KeyGateOptions, 'now' | 'setTimeout'>> & KeyGateOptions
  private inFlight: AbortController | null = null
  /** Bumped by cancel() or a fresh submit(); a stale attempt's response is dropped (schedule.ts's guard). */
  private generation = 0

  private _state: KeyGateState
  private _failure: Failure | undefined
  private _draftValue = ''

  constructor(options: KeyGateOptions) {
    this.opts = {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      ...options,
    }
    const existing = options.settings.apiKey?.trim()
    this._state = existing ? 'unblocked' : 'blocked-empty'
  }

  get state(): KeyGateState {
    return this._state
  }

  get failure(): Failure | undefined {
    return this._failure
  }

  /** The typed draft, retained across cancel and across a failed attempt. */
  get draftValue(): string {
    return this._draftValue
  }

  /**
   * Submits a candidate key. Empty or whitespace-only input never reaches
   * the transport. A second activation while already validating is a
   * no-op - single-flight, no second request fires until this one settles
   * or is cancelled.
   */
  async submit(value: string): Promise<void> {
    this._draftValue = value
    const trimmed = value.trim()

    if (trimmed.length === 0) {
      this._state = 'blocked-empty'
      this._failure = undefined
      return
    }

    if (this._state === 'validating') return

    this.generation++
    const generation = this.generation
    const controller = new AbortController()
    this.inFlight = controller
    this._state = 'validating'
    this._failure = undefined

    try {
      await this.opts.transport(trimmed, controller.signal)
      if (controller.signal.aborted || generation !== this.generation) return
      this.opts.settings.apiKey = trimmed
      this._state = 'unblocked'
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return
      // classifyFailure never echoes the raw error, and it is never rethrown
      // or stored beyond its classification - the key must never end up in
      // an error object (AC-1.11, NFR-3).
      this._failure = classifyFailure(error)
      this._state = 'blocked-error'
    } finally {
      if (this.inFlight === controller) this.inFlight = null
    }
  }

  /**
   * FR-12's AC-12.4: the stored key was rejected by a request made after the
   * gate was already passed, so the session's authentication is over and the
   * gate goes back up mid-session.
   *
   * The stored key is dropped along with it. Keeping a key that OpenRouter
   * has just refused would leave the app unblocking itself on the next reload
   * (AC-1.8 trusts a stored key without re-validation) and failing again on
   * the first request - the gate would be telling the user their key works
   * while every request says otherwise.
   *
   * The document is untouched: this is a state change on the gate alone, and
   * the editor view stays mounted behind it, which is what makes AC-12.4's
   * "document content is intact when the gate is passed again" true without
   * anything having to save or restore it.
   */
  revoke(): void {
    this.generation++
    if (this.inFlight) {
      this.inFlight.abort()
      this.inFlight = null
    }
    this.opts.settings.apiKey = ''
    this._failure = classifyFailure({ status: 401 })
    this._state = 'blocked-revoked'
  }

  /** Abandons an in-flight validation (or a settled one) and returns to blocked-empty, keeping the typed draft. */
  cancel(): void {
    this.generation++
    if (this.inFlight) {
      this.inFlight.abort()
      this.inFlight = null
    }
    this._state = 'blocked-empty'
  }
}
