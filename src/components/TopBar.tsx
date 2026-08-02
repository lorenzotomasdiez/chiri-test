import { useState } from 'react'
import { Icon } from './Icon'
import { PredictionsToggle } from './PredictionsToggle'
import { ModelSelector } from './ModelSelector'
import { FailureBanner } from './FailureBanner'
import { StorageWarningBanner } from './StorageWarningBanner'
import { useAppStore } from '../state/store'
import { deriveFilename, toExportText } from '../core/export'

/**
 * The fixed 48px top bar (CC-NAV): wordmark, Predictions toggle, model
 * selector, a divider, then Copy and Download. Icons draw from the local
 * sprite; CC-BRAND.2 keeps a mark away from the wordmark, which is a rule
 * about the brand and not about the action buttons, where CC-NAV.7 requires
 * icon plus label.
 *
 * FR-9: Copy and Download both call src/core/export.ts's `toExportText` on
 * the same document string, which is what makes their output byte-identical
 * rather than merely usually-the-same. Download's filename comes from the
 * same module's `deriveFilename`. A clipboard write that rejects surfaces
 * FR-12's dismissible retry treatment rather than failing silently or
 * blocking Download, which reads the document directly and does not touch
 * the clipboard at all.
 */
export function TopBar() {
  const [copyState, setCopyState] = useState<'idle' | 'visible' | 'fading'>('idle')
  const [copyFailed, setCopyFailed] = useState(false)
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false)
  const documentText = useAppStore((s) => s.documentText)
  const keyPersisted = useAppStore((s) => s.keyPersisted)

  async function writeToClipboard() {
    const text = toExportText(documentText)
    try {
      await navigator.clipboard.writeText(text)
      setCopyFailed(false)
      setCopyState('visible')
      window.setTimeout(() => setCopyState('fading'), 3000)
      window.setTimeout(() => setCopyState('idle'), 5000)
    } catch {
      setCopyState('idle')
      setCopyFailed(true)
    }
  }

  function handleCopy() {
    void writeToClipboard()
  }

  function handleDownload() {
    const text = toExportText(documentText)
    const filename = deriveFilename(documentText)
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 z-10 flex h-12 w-full items-center justify-between border-b border-hairline bg-paper px-6"
      style={{ borderBottomColor: '#C7C6CA' }}
    >
      <span className="select-none text-[18px] font-semibold tracking-tight text-ink">Chiri</span>

      <div className="flex items-center gap-6">
        <PredictionsToggle />
        <ModelSelector />

        <div
          role="separator"
          aria-orientation="vertical"
          style={{ width: 1, height: 16, borderLeft: '1px solid #C7C6CA' }}
        />

        <div className="flex items-center gap-4">
          <button
            type="button"
            tabIndex={0}
            data-testid="copy-button"
            aria-label="Copy"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded text-[14px] text-ink opacity-70 transition-opacity duration-200 hover:opacity-100 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="content_copy" className="text-[12px]" />
            Copy
          </button>

          {copyState !== 'idle' && (
            <span
              data-testid="copy-confirmation"
              aria-live="polite"
              className={`select-none text-[10px] font-medium tracking-wide text-ink/40 uppercase transition-opacity duration-[2000ms] ${
                copyState === 'fading' ? 'opacity-0' : 'opacity-100'
              }`}
            >
              Copied
            </span>
          )}

          <button
            type="button"
            tabIndex={0}
            data-testid="download-button"
            aria-label="Download .md"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded text-[14px] text-ink opacity-70 transition-opacity duration-200 hover:opacity-100 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="download" className="text-[12px]" />
            Download .md
          </button>
        </div>
      </div>

      {copyFailed && (
        <FailureBanner
          message="Couldn't copy to the clipboard."
          onRetry={() => void writeToClipboard()}
          onDismiss={() => setCopyFailed(false)}
        />
      )}
      {!keyPersisted && !storageWarningDismissed && (
        <StorageWarningBanner onDismiss={() => setStorageWarningDismissed(true)} />
      )}
    </header>
  )
}
