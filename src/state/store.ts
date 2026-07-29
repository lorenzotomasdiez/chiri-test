import { create } from 'zustand'
import { resolveModelId } from '../core/models'
import { KeyGate, type KeyGateState } from '../core/keygate'
import type { Failure } from '../core/provider'
import { classifyRequestFailure, isAbort } from '../core/failure'
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
   * FR-12's visible-failure surface for requested work - revisions (AC-12.2)
   * and refinements (AC-7.6) alike. One banner, not one per caller: the
   * refinement widget is a plain WidgetType outside React and cannot hold
   * React state at all, and two independent failure surfaces would be free to
   * contradict each other on screen. Whatever mounts FailureBanner
   * (Editor.tsx) reads these back out.
   *
   * Continuation never writes here. Its failures are silent by class
   * (AC-12.1), and `reportRequestFailure` is not on its path.
   */
  requestFailureMessage: string | null
  requestRetry: (() => void) | null
  /**
   * Classifies a thrown request failure and does the one right thing with it:
   * a rejected key returns the app to FR-1's gate (AC-12.4), anything else
   * becomes the dismissible, retryable banner (AC-12.2).
   */
  reportRequestFailure: (error: unknown, retry: () => void) => void
  clearRequestFailure: () => void
  /**
   * AC-12.4 from the silent side: a continuation request found the stored key
   * rejected. Nothing is shown for the failure itself, but the gate still
   * goes back up.
   */
  reportSilentFailure: (error: unknown) => void

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

    requestFailureMessage: null,
    requestRetry: null,
    reportRequestFailure: (error, retry) => {
      if (isAbort(error)) return
      const failure = classifyRequestFailure(error)
      if (failure.routesToKeyGate) {
        // The gate takes precedence over any banner already on screen
        // (T-FR-12-17): a message about one request that did not complete is
        // noise next to a modal saying the session's key no longer works, and
        // leaving it showing alongside the gate reads as two unrelated
        // problems when there is one.
        set({ requestFailureMessage: null, requestRetry: null })
        keyGate.revoke()
        syncGate()
        return
      }
      set({
        requestFailureMessage: failure.message,
        requestRetry: retry,
      })
    },
    clearRequestFailure: () => set({ requestFailureMessage: null, requestRetry: null }),
    reportSilentFailure: (error) => {
      if (isAbort(error)) return
      if (!classifyRequestFailure(error).routesToKeyGate) return
      set({ requestFailureMessage: null, requestRetry: null })
      keyGate.revoke()
      syncGate()
    },

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
