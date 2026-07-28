import { useEffect, useRef } from 'react'

/**
 * Buffers keystrokes typed while the launch screen is up.
 *
 * The launch screen is entirely non-interactive (CC-SPLASH.5): a keystroke
 * there does not focus anything, does not dismiss anything, and does not
 * skip the dwell ahead. But AC-2.4 forbids losing that input outright, so it
 * is captured here and handed to the next surface once the launch state
 * ends, rather than discarded (FR-2).
 */
export function useLaunchKeyBuffer(active: boolean) {
  const bufferRef = useRef('')

  useEffect(() => {
    if (!active) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Enter') {
        bufferRef.current += '\n'
      } else if (event.key === 'Backspace') {
        bufferRef.current = bufferRef.current.slice(0, -1)
      } else if (event.key.length === 1) {
        bufferRef.current += event.key
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])

  return bufferRef
}
