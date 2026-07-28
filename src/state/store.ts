import { create } from 'zustand'
import { DEFAULT_MODEL_ID } from '../core/models'

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
}

export const useAppStore = create<AppState>((set) => ({
  predictionsEnabled: true,
  togglePredictions: () => set((s) => ({ predictionsEnabled: !s.predictionsEnabled })),
  selectedModelId: DEFAULT_MODEL_ID,
  setSelectedModelId: (id) => set({ selectedModelId: id }),
}))
