import { reactive, toRef, watch } from 'vue'
import { readStorage, writeStorage } from './services/storage'
import { reportAppError } from './services/appErrors'

export type FontSize = 'smallest' | 'small' | 'normal' | 'large' | 'largest'
export type VisualTheme = 'default' | 'forces-of-fantasy' | 'powers-of-chaos' | 'legions-of-undead' | 'ravening-hordes'

type SettingsState = {
  darkMode: boolean
  compactRows: boolean
  fontSize: FontSize
  boldText: boolean
  visualTheme: VisualTheme
}

const storageKey = 'olddex.settings.v0.11'

const defaults: SettingsState = {
  darkMode: false,
  compactRows: false,
  fontSize: 'normal',
  boldText: false,
  visualTheme: 'default',
}

function normalizeFontSize(value: unknown): FontSize {
  if (['smallest', 'small', 'normal', 'large', 'largest'].includes(String(value))) return value as FontSize
  return 'normal'
}

function normalizeVisualTheme(value: unknown): VisualTheme {
  const allowed: VisualTheme[] = ['default', 'forces-of-fantasy', 'powers-of-chaos', 'legions-of-undead', 'ravening-hordes']
  return allowed.includes(String(value) as VisualTheme) ? value as VisualTheme : 'default'
}

function loadSettings(): SettingsState {
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const current = JSON.parse(readStorage(storageKey) || '{}')
    const legacy = JSON.parse(readStorage('olddex.settings.v0.10') || readStorage('olddex.settings.v0.9') || readStorage('olddex.settings.v0.8') || readStorage('olddex.settings.v0.7') || readStorage('olddex.settings.v0.6') || readStorage('olddex.settings.v0.4') || '{}')
    const saved = Object.keys(current).length ? current : legacy
    return {
      darkMode: Boolean(saved.darkMode),
      compactRows: Boolean(saved.compactRows),
      fontSize: normalizeFontSize(saved.fontSize),
      boldText: Boolean(saved.boldText),
      visualTheme: normalizeVisualTheme(saved.visualTheme),
    }
  } catch (error) {
    reportAppError(error, 'SETTINGS_DATA_INVALID')
    return { ...defaults }
  }
}

const state = reactive<SettingsState>(loadSettings())

function applySettings() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = state.darkMode ? 'dark' : 'light'
  document.documentElement.dataset.density = state.compactRows ? 'compact' : 'comfortable'
  document.documentElement.dataset.fontSize = state.fontSize
  document.documentElement.dataset.boldText = state.boldText ? 'true' : 'false'
  document.documentElement.dataset.factionTheme = state.visualTheme
}

watch(
  state,
  () => {
    applySettings()
    if (typeof window !== 'undefined') {
      writeStorage(storageKey, JSON.stringify(state))
    }
  },
  { deep: true, immediate: true },
)

export function useSettings() {
  return {
    darkMode: toRef(state, 'darkMode'),
    compactRows: toRef(state, 'compactRows'),
    fontSize: toRef(state, 'fontSize'),
    boldText: toRef(state, 'boldText'),
    visualTheme: toRef(state, 'visualTheme'),
    toggleTheme: () => { state.darkMode = !state.darkMode },
    reset: () => Object.assign(state, defaults),
  }
}
