import { Icon } from './Icon'

interface StorageWarningBannerProps {
  onDismiss: () => void
}

/**
 * PRD Q1-b's settled decision (docs/tech/chiri/index.md open question 2,
 * docs/tests/chiri/fr-1.md T-FR-1-17): when local storage is unavailable the
 * app runs in memory rather than refusing to start, but the user is told, per
 * CC-BANNER.6's informational treatment - no retry, since a browser that just
 * threw on setItem has nothing this session can retry.
 */
export function StorageWarningBanner({ onDismiss }: StorageWarningBannerProps) {
  return (
    <div
      data-testid="storage-warning"
      role="alert"
      className="fixed top-14 left-6 z-30 flex items-center gap-3 rounded border-l-2 border-ink bg-paper px-4 py-3 text-[14px] text-ink shadow-[0_4px_32px_rgba(0,0,0,0.08)]"
    >
      <Icon name="info" className="shrink-0 text-ink" />
      <span>This browser can't save your work, so it will be lost when this tab closes - editing still works.</span>
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
