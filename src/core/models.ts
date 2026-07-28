/**
 * The curated model catalog - FR-8 in full.
 *
 * Pure data and types only: no React, no CodeMirror, no zustand, no
 * floating-ui. The oxlint override on src/core/**\/*.ts enforces this so the
 * catalog stays testable with nothing running.
 */

export interface ModelOption {
  /** The provider slug, e.g. 'openai/gpt-4o-mini'. Never shown in the top bar. */
  id: string
  /** The short friendly name shown in the trigger and the dropdown row. */
  displayName: string
  /** A short note ("fast, low cost") that lets a user choose without prior knowledge. */
  capabilityNote: string
}

export const MODELS: ModelOption[] = [
  {
    id: 'openai/gpt-4o-mini',
    displayName: 'GPT-4o mini',
    capabilityNote: 'fast, low cost',
  },
  {
    id: 'openai/gpt-4o',
    displayName: 'GPT-4o',
    capabilityNote: 'stronger reasoning, slower',
  },
  {
    id: 'openai/gpt-4.1',
    displayName: 'GPT-4.1',
    capabilityNote: 'large context',
  },
]

export const DEFAULT_MODEL_ID = 'openai/gpt-4o-mini'

/**
 * Resolves a persisted model id against the curated catalog. A persisted id
 * that is missing, empty, or no longer curated falls back to the default
 * rather than flowing straight into a request (AC-8.x: a stale selection
 * never blocks or silently breaks continuation/revision).
 */
export function resolveModelId(persistedId?: string): string {
  if (persistedId && MODELS.some((m) => m.id === persistedId)) return persistedId
  return DEFAULT_MODEL_ID
}
