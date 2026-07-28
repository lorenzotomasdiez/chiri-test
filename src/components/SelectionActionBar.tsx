import { useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { useAppStore } from '../state/store'
import { buildRevisionRequest } from '../core/prompt'
import { checkParagraphCount, validateResponseSpan } from '../core/revision'
import { splitRevisionResponse } from '../core/provider'
import { requestRevisionCompletion } from '../net/openrouter'
import { setPendingRevisionEffect } from '../editor/pendingRevision'

interface OneTapAction {
  testId: string
  label: string
  instruction: string
}

/** AC-6.2's one-tap set: improve the writing, make it shorter, change the tone, fix grammar and spelling. */
const ONE_TAP_ACTIONS: OneTapAction[] = [
  {
    testId: 'action-improve-writing',
    label: 'Improve the writing',
    instruction: 'Improve the writing.',
  },
  { testId: 'action-make-shorter', label: 'Make it shorter', instruction: 'Make it shorter.' },
  { testId: 'action-change-tone', label: 'Change the tone', instruction: 'Change the tone.' },
  {
    testId: 'action-fix-grammar',
    label: 'Fix grammar and spelling',
    instruction: 'Fix grammar and spelling.',
  },
]

interface SelectionActionBarProps {
  view: EditorView
  from: number
  to: number
}

/**
 * The floating action bar raised over a non-empty selection (AC-6.2), a
 * compact primary "Ask AI" button (CC-BTN.3) plus one-tap secondary chips
 * (CC-BTN.4) and a borderless instruction field (CC-INPUT.5) inside a
 * floating panel (CC-PANEL.1-5). Positioned off `coordsAtPos` of the
 * selection's own start and end, the same values the selection's rendered
 * rectangles are read from, and always below the selection so it never
 * covers the text it refers to.
 */
export function SelectionActionBar({ view, from, to }: SelectionActionBarProps) {
  const [instruction, setInstruction] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const modelId = useAppStore((s) => s.selectedModelId)
  const apiKey = useAppStore((s) => s.apiKey)

  const startCoords = view.coordsAtPos(from)
  const endCoords = view.coordsAtPos(to)
  const selectionBottom = Math.max(startCoords?.bottom ?? 0, endCoords?.bottom ?? 0)
  const left = startCoords?.left ?? 0
  const top = selectionBottom + 8

  async function runRevision(userInstruction: string) {
    if (busy) return
    const selectedText = view.state.sliceDoc(from, to)
    const guard = checkParagraphCount(selectedText)
    if (guard.kind === 'refused') {
      setMessage(guard.message)
      return
    }

    setMessage(null)
    setBusy(true)

    try {
      const promptText = userInstruction ? `${userInstruction}\n\n${selectedText}` : selectedText
      const requestBody = buildRevisionRequest(modelId, promptText)

      let raw: string
      try {
        raw = await requestRevisionCompletion(requestBody, apiKey)
      } catch {
        setMessage('The revision request did not complete.')
        return
      }

      const split = splitRevisionResponse(raw)
      if (!split) {
        setMessage('The revision could not be understood.')
        return
      }

      const result = validateResponseSpan(view.state.doc.toString(), from, to, split.body)
      if (result.kind === 'declined') {
        setMessage('That revision touched text outside the selection and was discarded.')
        return
      }

      view.dispatch({
        effects: setPendingRevisionEffect.of({
          ...result.pending,
          reason: split.reason,
          modelId,
        }),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-testid="selection-action-bar"
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 8,
        backgroundColor: '#FFFFFF',
        border: '1px solid rgba(199, 198, 202, 0.3)',
        borderRadius: 8,
        boxShadow: 'none',
      }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="action-ask-ai"
          className="rounded bg-ink px-3 py-1 text-[13px] font-medium text-white"
          onClick={() => runRevision(instruction)}
        >
          Ask AI
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {ONE_TAP_ACTIONS.map((action) => (
          <button
            key={action.testId}
            type="button"
            data-testid={action.testId}
            className="rounded border border-outline px-2 py-1 text-[12px] text-ink"
            onClick={() => runRevision(action.instruction)}
          >
            {action.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        data-testid="action-custom-instruction"
        placeholder="Tell Chiri what to do..."
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && instruction.trim().length > 0) runRevision(instruction)
        }}
        style={{ border: 'none', outline: 'none', fontSize: 13 }}
      />

      {message && (
        <div data-testid="action-message" style={{ fontSize: 12, color: '#B3261E' }}>
          {message}
        </div>
      )}
    </div>
  )
}
