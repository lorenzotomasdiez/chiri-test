import { useState } from 'react'
import { Icon } from './Icon'
import { PredictionsToggle } from './PredictionsToggle'
import { ModelSelector } from './ModelSelector'

/**
 * The fixed 48px top bar (CC-NAV): wordmark, Predictions toggle, model
 * selector, a divider, then Copy and Download. Every icon here uses the
 * text variant - the bar's accessible surface carries zero <svg> elements
 * by design (CC-BRAND.2's "no mark next to the wordmark" extends to the
 * whole bar in the anatomy test).
 *
 * Copy and Download do not perform the real clipboard/download behaviour
 * (FR-9) - that is out of scope for this run. Copy shows a transient
 * confirmation label only.
 */
export function TopBar() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <banner
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
            aria-label="Copy"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded text-[14px] text-ink opacity-70 transition-opacity duration-200 hover:opacity-100 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="content_copy" variant="text" className="text-[12px]" />
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            type="button"
            aria-label="Download .md"
            className="flex items-center gap-1.5 rounded text-[14px] text-ink opacity-70 transition-opacity duration-200 hover:opacity-100 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="download" variant="text" className="text-[12px]" />
            Download .md
          </button>
        </div>
      </div>
    </banner>
  )
}
