import { reactive, toRef, watch } from 'vue'
import { readStorage, writeStorage } from './services/storage'
import { reportAppError } from './services/appErrors'

export type FontSize = 'smallest' | 'small' | 'normal' | 'large' | 'largest'
export type VisualTheme = 'default' | 'forces-of-fantasy' | 'powers-of-chaos' | 'legions-of-undead' | 'ravening-hordes'
export type BackgroundChoice = 'none' | 'background-1' | 'background-2' | 'background-3' | 'background-4'

type SettingsState = {
  darkMode: boolean
  compactRows: boolean
  fontSize: FontSize
  boldText: boolean
  visualTheme: VisualTheme
  backgroundImage: BackgroundChoice
  bootAudioEnabled: boolean
}

const storageKey = 'olddex.settings.v0.13'

const defaults: SettingsState = {
  darkMode: false,
  compactRows: false,
  fontSize: 'normal',
  boldText: false,
  visualTheme: 'default',
  backgroundImage: 'none',
  bootAudioEnabled: true,
}

function normalizeFontSize(value: unknown): FontSize {
  if (['smallest', 'small', 'normal', 'large', 'largest'].includes(String(value))) return value as FontSize
  return 'normal'
}

function normalizeVisualTheme(value: unknown): VisualTheme {
  const allowed: VisualTheme[] = ['default', 'forces-of-fantasy', 'powers-of-chaos', 'legions-of-undead', 'ravening-hordes']
  return allowed.includes(String(value) as VisualTheme) ? value as VisualTheme : 'default'
}

function normalizeBackgroundChoice(value: unknown): BackgroundChoice {
  const allowed: BackgroundChoice[] = ['none', 'background-1', 'background-2', 'background-3', 'background-4']
  return allowed.includes(String(value) as BackgroundChoice) ? value as BackgroundChoice : 'none'
}

function loadSettings(): SettingsState {
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const current = JSON.parse(readStorage(storageKey) || '{}')
    const legacy = JSON.parse(readStorage('olddex.settings.v0.12') || readStorage('olddex.settings.v0.11') || readStorage('olddex.settings.v0.10') || readStorage('olddex.settings.v0.9') || readStorage('olddex.settings.v0.8') || readStorage('olddex.settings.v0.7') || readStorage('olddex.settings.v0.6') || readStorage('olddex.settings.v0.4') || '{}')
    const saved = Object.keys(current).length ? current : legacy
    return {
      darkMode: Boolean(saved.darkMode),
      compactRows: Boolean(saved.compactRows),
      fontSize: normalizeFontSize(saved.fontSize),
      boldText: Boolean(saved.boldText),
      visualTheme: normalizeVisualTheme(saved.visualTheme),
      backgroundImage: normalizeBackgroundChoice(saved.backgroundImage),
      bootAudioEnabled: saved.bootAudioEnabled !== false,
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
  document.documentElement.dataset.background = state.backgroundImage
}

watch(
  state,
  () => {
    applySettings()
    if (typeof window !== 'undefined') writeStorage(storageKey, JSON.stringify(state))
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
    backgroundImage: toRef(state, 'backgroundImage'),
    bootAudioEnabled: toRef(state, 'bootAudioEnabled'),
    toggleTheme: () => { state.darkMode = !state.darkMode },
    reset: () => Object.assign(state, defaults),
  }
}
