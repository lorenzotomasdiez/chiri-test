import { DEFAULT_MODEL_ID } from '../core/models'

/** Section 5 of the blueprint: the whole of what is persisted per document. */
export interface Settings {
  apiKey: string
  model: string
  continuationEnabled: boolean
}

export interface SettingsHandle {
  /** A plain object whose property writes persist. src/core never imports this module - it is only ever handed this object. */
  settings: Settings
  /** False once a write has failed - PRD Q1-b's degrade-to-memory signal rather than a crash. */
  keyPersisted: boolean
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'chiri-settings'

const DEFAULTS: Settings = {
  apiKey: '',
  model: DEFAULT_MODEL_ID,
  continuationEnabled: true,
}

function readInitial(storage: StorageLike): Settings {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULTS.apiKey,
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULTS.model,
      continuationEnabled:
        typeof parsed.continuationEnabled === 'boolean'
          ? parsed.continuationEnabled
          : DEFAULTS.continuationEnabled,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * Reads localStorage once at boot and wraps it behind a plain Settings
 * object whose property writes persist. A throwing or blocked store
 * degrades to an in-memory object plus keyPersisted: false rather than
 * crashing (PRD Q1-b). Tests inject a plain-object fake in place of
 * window.localStorage.
 */
export function createSettingsHandle(storage: StorageLike = window.localStorage): SettingsHandle {
  const initial = readInitial(storage)
  const handle: SettingsHandle = { settings: {} as Settings, keyPersisted: true }

  let apiKey = initial.apiKey
  let model = initial.model
  let continuationEnabled = initial.continuationEnabled

  function persist() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, model, continuationEnabled }))
      handle.keyPersisted = true
    } catch {
      handle.keyPersisted = false
    }
  }

  Object.defineProperty(handle.settings, 'apiKey', {
    enumerable: true,
    get: () => apiKey,
    set: (v: string) => {
      apiKey = v
      persist()
    },
  })
  Object.defineProperty(handle.settings, 'model', {
    enumerable: true,
    get: () => model,
    set: (v: string) => {
      model = v
      persist()
    },
  })
  Object.defineProperty(handle.settings, 'continuationEnabled', {
    enumerable: true,
    get: () => continuationEnabled,
    set: (v: boolean) => {
      continuationEnabled = v
      persist()
    },
  })

  return handle
}
