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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedIndex = MODELS.findIndex((m) => m.id === selectedModelId)
  const selected = MODELS[selectedIndex] ?? MODELS[0]

  function open() {
    setHighlightedIndex(selectedIndex === -1 ? 0 : selectedIndex)
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
        data-testid="model-selector-trigger"
        aria-label={selected.displayName}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
        className="flex items-center gap-1 rounded px-1 text-[14px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {selected.displayName}
        <Icon name="expand_more" variant="text" className="text-outline text-[14px]" />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          data-testid="model-selector-panel"
          role="listbox"
          style={{
            position: 'fixed',
            top: 48,
            right: 24,
            width: 288,
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            border: '1px solid #C7C6CA',
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
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isHighlighted ? '#F1EDEC' : 'transparent',
                  borderTop: index === 0 ? 'none' : '1px solid rgb(199 198 202 / 0.1)',
                }}
              >
                <div>
                  <div
                    data-testid="model-row-title"
                    style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F' }}
                  >
                    {model.displayName}
                  </div>
                  <div data-testid="model-row-note" style={{ fontSize: 10, color: '#46464A' }}>
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
