import { useState } from 'react'
import { Icon } from './Icon'

interface FailureBannerProps {
  message: string
  onRetry: () => void
  onDismiss: () => void
}

/** CC-BANNER.5's dismiss half: fade+slide duration, honored below. */
const DISMISS_ANIMATION_MS = 200

/**
 * FR-12's revision-failure treatment, reused here for FR-9's clipboard write
 * failure: a dismissible one-line banner with a retry affordance, rather than
 * a silent no-op or a blocking dialog. Nothing FR-12-specific lives here -
 * this is the generic shape, so any other failing async action in the shell
 * can reuse it instead of inlining its own.
 */
export function FailureBanner({ message, onRetry, onDismiss }: FailureBannerProps) {
  const [dismissing, setDismissing] = useState(false)

  const handleDismiss = () => {
    // CC-BANNER.5: play the exit animation before actually unmounting, same
    // as useLaunchDwell's reduced-motion handling - under reduced motion
    // there is no animation left to protect, so the removal is instant.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setDismissing(true)
    window.setTimeout(onDismiss, reduced ? 0 : DISMISS_ANIMATION_MS)
  }

  return (
    <div
      data-testid="failure-message"
      role="alert"
      className={`fixed top-14 right-6 z-30 flex items-center gap-3 rounded border border-hairline/30 bg-banner px-4 py-3 text-[14px] text-error shadow-[0_4px_32px_rgba(0,0,0,0.08)] ${
        dismissing ? 'animate-banner-out' : 'animate-banner-in'
      }`}
    >
      <Icon name="error" className="shrink-0 text-error" />
      <span>{message}</span>
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
        onClick={handleDismiss}
        className="rounded text-[14px] text-muted/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Dismiss
      </button>
    </div>
  )
}
