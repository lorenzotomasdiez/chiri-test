import { useEffect, useRef, useState } from 'react'
import { Launch } from '../core/launch'

/** CC-MOTION.1's duration, and therefore the minimum dwell: a fast boot must
 *  not cut the signature animation off mid-flight (AC-2.2). */
export const SPLASH_MIN_DWELL_MS = 1200

/**
 * Holds the launch screen for at least SPLASH_MIN_DWELL_MS, then reports that
 * the launch state is over. AC-2.2: when the app becomes ready sooner than the
 * dwell, the mark stays until the dwell elapses and then transitions exactly
 * once - never a flash, never a second transition. The state ends at
 * max(dwellDeadline, readyTime), per src/core/launch.ts.
 *
 * `ready` is the caller's readiness signal (AC-2.3's key-gate-versus-editor
 * decision) - the launch state never ends before it is delivered, even under
 * reduced motion.
 */
export function useLaunchDwell(ready: boolean): boolean {
  const [complete, setComplete] = useState(false)
  const launchRef = useRef<Launch | null>(null)

  useEffect(() => {
    // CC-MOTION.9: under reduced motion the launch state is an instant change,
    // so there is no animation left for a dwell to protect - but readiness is
    // still required; reduced motion removes the dwell floor, not the ready
    // gate.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    launchRef.current = new Launch({
      minDwellMs: reduced ? 0 : SPLASH_MIN_DWELL_MS,
      now: () => Date.now(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      onComplete: () => setComplete(true),
    })
  }, [])

  useEffect(() => {
    if (ready) launchRef.current?.onReady()
  }, [ready])

  return complete
}
