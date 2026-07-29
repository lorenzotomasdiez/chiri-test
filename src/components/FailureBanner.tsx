import { Icon } from './Icon'

interface FailureBannerProps {
  message: string
  onRetry: () => void
  onDismiss: () => void
}

/**
 * FR-12's revision-failure treatment, reused here for FR-9's clipboard write
 * failure: a dismissible one-line banner with a retry affordance, rather than
 * a silent no-op or a blocking dialog. Nothing FR-12-specific lives here -
 * this is the generic shape, so any other failing async action in the shell
 * can reuse it instead of inlining its own.
 */
export function FailureBanner({ message, onRetry, onDismiss }: FailureBannerProps) {
  return (
    <div
      data-testid="failure-message"
      role="alert"
      className="fixed top-14 right-6 z-30 flex items-center gap-3 rounded border border-hairline/30 bg-paper px-4 py-3 text-[14px] text-error shadow-[0_4px_32px_rgba(0,0,0,0.08)]"
    >
      <Icon name="error" className="shrink-0 text-error" />
      <span>{message}</span>
      <button
        type="button"
        data-testid="retry-button"
        onClick={onRetry}
        className="shrink-0 rounded bg-ink px-3 py-1 text-xs font-medium text-white transition-opacity duration-200 hover:opacity-90 active:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink focus-visible:ring-offset-1 focus-visible:ring-offset-panel"
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
