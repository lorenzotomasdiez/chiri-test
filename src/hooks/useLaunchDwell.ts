import { useEffect, useState } from 'react'

/** CC-MOTION.1's duration, and therefore the minimum dwell: a fast boot must
 *  not cut the signature animation off mid-flight (AC-2.2). */
export const SPLASH_MIN_DWELL_MS = 1200

/**
 * Holds the launch screen for at least SPLASH_MIN_DWELL_MS, then reports that
 * the launch state is over. AC-2.2: when the app becomes ready sooner than the
 * dwell, the mark stays until the dwell elapses and then transitions exactly
 * once - never a flash, never a second transition.
 */
export function useLaunchDwell(): boolean {
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    // CC-MOTION.9: under reduced motion the launch state is an instant change,
    // so there is no animation left for a dwell to protect.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setElapsed(true)
      return
    }
    const handle = window.setTimeout(() => setElapsed(true), SPLASH_MIN_DWELL_MS)
    return () => window.clearTimeout(handle)
  }, [])

  return elapsed
}
