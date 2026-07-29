import { useEffect, useRef, useState } from 'react'
import { MODELS } from '../core/models'
import { useAppStore } from '../state/store'
import { Icon } from './Icon'

/**
 * The model trigger plus its floating dropdown panel (CC-MODEL). The panel
 * is a fixed anchor (top: 48px, right: 24px) rather than floating-ui
 * placement, which the brief allows for a bar-anchored panel this simple.
 * No hand-rolled focus trap: Escape, outside click, focus return and
 * ArrowUp/Down/Enter are handled explicitly instead.
 */
export function ModelSelector() {
  const selectedModelId = useAppStore((s) => s.selectedModelId)
  const setSelectedModelId = useAppStore((s) => s.setSelectedModelId)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [panelRight, setPanelRight] = useState(24)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedIndex = MODELS.findIndex((m) => m.id === selectedModelId)
  const selected = MODELS[selectedIndex] ?? MODELS[0]

  function open() {
    setHighlightedIndex(selectedIndex === -1 ? 0 : selectedIndex)
    // Measured at open time: the trigger's label is the selected model name,
    // so its width changes with the selection and cannot be a constant.
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPanelRight(Math.max(24, window.innerWidth - rect.right))
    setIsOpen(true)
  }

  function close() {
    setIsOpen(false)
  }

  function commit(index: number) {
    const model = MODELS[index]
    if (model) setSelectedModelId(model.id)
    close()
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        triggerRef.current?.focus()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, MODELS.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        commit(highlightedIndex)
      }
    }

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, highlightedIndex])

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        data-testid="model-selector-trigger"
        aria-label={selected.displayName}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
        className="group flex items-center gap-1 rounded px-1 text-[14px] text-ink transition-colors duration-150 hover:bg-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {selected.displayName}
        <Icon
          name="expand_more"
          className="text-outline text-[14px] opacity-70 transition-opacity duration-150 group-hover:opacity-100"
        />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          data-testid="model-selector-panel"
          role="listbox"
          className="rounded-lg border border-hairline bg-panel"
          style={{
            // Flush to the bottom of the 48px bar, right-aligned to the
            // trigger rather than to the viewport gutter. CC-MODEL.5's
            // `right: 24px` was measured off a mockup whose Copy and Download
            // were icon-only - the rendering CC-NAV.7 rejects. Restoring the
            // full labels widens that cluster by ~200px and pushes the trigger
            // left, so a viewport-anchored panel detaches from the control
            // that opened it. Clamped to a 24px gutter at narrow widths.
            position: 'fixed',
            top: 48,
            right: panelRight,
            width: 288,
          }}
        >
          {MODELS.map((model, index) => {
            const isHighlighted = index === highlightedIndex
            const isSelected = model.id === selectedModelId
            return (
              <div
                key={model.id}
                data-testid="model-row"
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => commit(index)}
                className={`flex cursor-pointer items-center justify-between px-4 py-3 ${
                  isHighlighted ? 'bg-container' : 'bg-transparent'
                } ${index === 0 ? 'border-t-0' : 'border-t border-hairline/10'}`}
              >
                <div>
                  <div data-testid="model-row-title" className="text-[14px] font-medium text-ink">
                    {model.displayName}
                  </div>
                  <div data-testid="model-row-note" className="text-[10px] text-muted">
                    {model.capabilityNote}
                  </div>
                </div>
                {isSelected && (
                  <span data-testid="check-icon">
                    <Icon name="check" className="text-ink" />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
