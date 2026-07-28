/**
 * The launch state machine (FR-2, AC-2.2).
 *
 * Pure by construction, the same way src/core/schedule.ts and
 * src/core/keygate.ts are: no DOM, no React, no timers off `window`. The
 * clock and the timer are injected, so the dwell-versus-readiness race runs
 * in virtual time with nothing running.
 *
 * The launch state ends at max(dwellDeadline, readyTime): it is held for at
 * least minDwellMs regardless of how early the app signals readiness, and it
 * is never held any longer than necessary once readiness has arrived after
 * the dwell has already elapsed. Completion is reported exactly once, ever.
 */

export interface LaunchOptions {
  /** The minimum time the launch state is held, regardless of readiness. */
  minDwellMs: number
  now?: () => number
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  /** Called exactly once, the instant both the dwell and readiness are satisfied. */
  onComplete?: () => void
}

export class Launch {
  private readonly opts: Required<Pick<LaunchOptions, 'minDwellMs' | 'now' | 'setTimeout'>> &
    LaunchOptions

  private dwellElapsed = false
  private ready = false
  private completed = false

  constructor(options: LaunchOptions) {
    this.opts = {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      ...options,
    }

    this.opts.setTimeout(() => {
      this.dwellElapsed = true
      this.maybeComplete()
    }, this.opts.minDwellMs)
  }

  /** True while the launch screen must stay on screen. */
  isActive(): boolean {
    return !this.completed
  }

  /** Signals that the app is ready to show its next surface. */
  onReady(): void {
    this.ready = true
    this.maybeComplete()
  }

  private maybeComplete(): void {
    if (this.completed) return
    if (!this.dwellElapsed || !this.ready) return

    this.completed = true
    this.opts.onComplete?.()
  }
}
