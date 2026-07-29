import { create } from 'zustand'
import { resolveModelId } from '../core/models'
import { KeyGate, type KeyGateState } from '../core/keygate'
import type { Failure } from '../core/provider'
import { createSettingsHandle } from '../storage/settings'
import { openRouterProbe } from '../net/openrouter'

const settingsHandle = createSettingsHandle()

/** FR-1's gate, wired to the real OpenRouter transport and the real settings sink. */
const keyGate = new KeyGate({
  transport: openRouterProbe,
  settings: settingsHandle.settings,
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
})

/**
 * The single cross-cutting store, reached only through this accessor module
 * per the blueprint's state rule. Every field that more than one component
 * needs to read or write gets added here, not re-derived locally.
 */
export interface AppState {
  /** FR-10's off switch. On by default. */
  predictionsEnabled: boolean
  togglePredictions: () => void
  /** AC-8.1: defaults to the curated catalog's default entry. */
  selectedModelId: string
  setSelectedModelId: (id: string) => void

  /** FR-9's source of truth for Copy/Download - mirrored from the editor's onDocChange. */
  documentText: string
  setDocumentText: (text: string) => void

  /** FR-6's revision requests read the key from here rather than the settings module directly - mirrored from settingsHandle the same way keyGate's fields are. */
  apiKey: string

  /**
   * FR-7's refinement-failure surfacing: the widget itself is a plain
   * WidgetType outside React, so a failed refinement turn reports here
   * instead of holding local component state, and whatever mounts
   * FailureBanner (Editor.tsx) reads it back out.
   */
  refinementFailureMessage: string | null
  refinementRetry: (() => void) | null
  setRefinementFailure: (message: string, retry: () => void) => void
  clearRefinementFailure: () => void

  /** FR-1's five-state key gate, mirrored here from the KeyGate instance. */
  keyGateState: KeyGateState
  keyGateFailure: Failure | undefined
  keyGateDraft: string
  /** Whether a key is on file - drives the gate's "Clear stored key" footer (KEEP.3). */
  hasStoredKey: boolean
  setKeyGateDraft: (value: string) => void
  submitKey: (value: string) => Promise<void>
  cancelKeySubmit: () => void
  clearApiKey: () => void
}

export const useAppStore = create<AppState>((set) => {
  function syncGate() {
    set({
      keyGateState: keyGate.state,
      keyGateFailure: keyGate.failure,
      keyGateDraft: keyGate.draftValue,
      hasStoredKey: settingsHandle.settings.apiKey.trim().length > 0,
      apiKey: settingsHandle.settings.apiKey,
    })
  }

  return {
    predictionsEnabled: settingsHandle.settings.continuationEnabled,
    togglePredictions: () =>
      set((s) => {
        const predictionsEnabled = !s.predictionsEnabled
        settingsHandle.settings.continuationEnabled = predictionsEnabled
        return { predictionsEnabled }
      }),
    selectedModelId: resolveModelId(settingsHandle.settings.model),
    setSelectedModelId: (id) => {
      settingsHandle.settings.model = id
      set({ selectedModelId: id })
    },

    documentText: '',
    setDocumentText: (text) => set({ documentText: text }),

    apiKey: settingsHandle.settings.apiKey,

    refinementFailureMessage: null,
    refinementRetry: null,
    setRefinementFailure: (message, retry) => set({ refinementFailureMessage: message, refinementRetry: retry }),
    clearRefinementFailure: () => set({ refinementFailureMessage: null, refinementRetry: null }),

    keyGateState: keyGate.state,
    keyGateFailure: keyGate.failure,
    keyGateDraft: keyGate.draftValue,
    hasStoredKey: settingsHandle.settings.apiKey.trim().length > 0,
    setKeyGateDraft: (value) => set({ keyGateDraft: value }),
    submitKey: async (value) => {
      const pending = keyGate.submit(value)
      syncGate()
      await pending
      syncGate()
    },
    cancelKeySubmit: () => {
      keyGate.cancel()
      syncGate()
    },
    clearApiKey: () => {
      settingsHandle.settings.apiKey = ''
      keyGate.cancel()
      syncGate()
    },
  }
})
