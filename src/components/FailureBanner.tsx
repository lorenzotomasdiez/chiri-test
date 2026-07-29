import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

interface FailureBannerProps {
  message: string | null
  onRetry: () => void
  onDismiss: () => void
}

// CC-BANNER.5 / CC-MOTION.6: 300ms fade + downward slide in, 200ms fade +
// upward slide out. The banner must stay mounted for the exit animation to
// play, so it tracks its own presence instead of being removed the instant
// `message` goes back to null.
const EXIT_MS = 200

/**
 * FR-12's revision-failure treatment, reused here for FR-9's clipboard write
 * failure: a dismissible one-line banner with a retry affordance, rather than
 * a silent no-op or a blocking dialog. Nothing FR-12-specific lives here -
 * this is the generic shape, so any other failing async action in the shell
 * can reuse it instead of inlining its own.
 */
export function FailureBanner({ message, onRetry, onDismiss }: FailureBannerProps) {
  const [displayedMessage, setDisplayedMessage] = useState(message)
  const [entered, setEntered] = useState(false)
  const [mounted, setMounted] = useState(message !== null)
  const exitTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (message !== null) {
      window.clearTimeout(exitTimeoutRef.current)
      setDisplayedMessage(message)
      setMounted(true)
      setEntered(false)
      const raf = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(raf)
    }

    setEntered(false)
    exitTimeoutRef.current = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(exitTimeoutRef.current)
  }, [message])

  if (!mounted || displayedMessage === null) return null

  return (
    <div
      data-testid="failure-message"
      role="alert"
      className={`fixed top-14 right-6 z-30 flex items-center gap-3 rounded border border-hairline/30 bg-paper px-4 py-3 text-[14px] text-error shadow-[0_4px_32px_rgba(0,0,0,0.08)] transition-[opacity,transform] duration-300 ease-out ${
        entered ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
      style={{ transitionDuration: entered ? '300ms' : `${EXIT_MS}ms` }}
    >
      <Icon name="error" className="shrink-0 text-error" />
      <span>{displayedMessage}</span>
      <button
        type="button"
        data-testid="retry-button"
        onClick={onRetry}
        className="rounded text-[14px] text-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Retry
      </button>
      <button
        type="button"
        data-testid="dismiss-button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="rounded text-[14px] text-muted/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Dismiss
      </button>
    </div>
  )
}
