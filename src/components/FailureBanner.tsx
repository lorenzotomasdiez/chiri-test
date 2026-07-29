import { Icon } from './Icon'

interface FailureBannerProps {
  message: string
  onRetry: () => void
  onDismiss: () => void
  /**
   * CC-BANNER.4 requires a banner to sit in the document flow directly
   * beneath the span it refers to, pushing text down rather than overlaying
   * it - true for Editor's revision-failure banner, which has room to grow
   * in flow beneath the document. TopBar's clipboard-failure banner instead
   * renders as a fixed corner overlay: TopBar is a fixed-height header that
   * cannot grow to push <main> down without also changing <main>'s
   * hardcoded top offset, so it keeps the overlay treatment until that
   * layout is revisited.
   */
  inline?: boolean
}

/**
 * FR-12's revision-failure treatment, reused here for FR-9's clipboard write
 * failure: a dismissible one-line banner with a retry affordance, rather than
 * a silent no-op or a blocking dialog. Nothing FR-12-specific lives here -
 * this is the generic shape, so any other failing async action in the shell
 * can reuse it instead of inlining its own.
 */
export function FailureBanner({ message, onRetry, onDismiss, inline = false }: FailureBannerProps) {
  return (
    <div
      data-testid="failure-message"
      role="alert"
      className={
        inline
          ? 'relative mt-4 flex items-center gap-3 rounded border border-hairline/30 bg-paper px-4 py-3 text-[14px] text-error shadow-[0_4px_32px_rgba(0,0,0,0.08)]'
          : 'fixed top-14 right-6 z-30 flex items-center gap-3 rounded border border-hairline/30 bg-paper px-4 py-3 text-[14px] text-error shadow-[0_4px_32px_rgba(0,0,0,0.08)]'
      }
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
        onClick={onDismiss}
        className="rounded text-[14px] text-muted/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Dismiss
      </button>
    </div>
  )
}
