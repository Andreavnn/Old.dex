import { ref, watch } from 'vue'

export type OldDexLanguage = 'en' | 'de' | 'fr' | 'es' | 'it' | 'pl' | 'zh'

export const languageOptions: Array<{ code: OldDexLanguage; label: string; short: string }> = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'it', label: 'Italiano', short: 'IT' },
  { code: 'pl', label: 'Polski', short: 'PL' },
  { code: 'zh', label: '中文', short: '中文' },
]

const KEY = 'olddex.language.v1'
function initialLanguage(): OldDexLanguage {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = window.localStorage.getItem(KEY) as OldDexLanguage | null
    return languageOptions.some((option) => option.code === stored) ? stored! : 'en'
  } catch { return 'en' }
}

const language = ref<OldDexLanguage>(initialLanguage())
watch(language, (value) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value === 'zh' ? 'zh-CN' : value
    document.documentElement.dataset.language = value
  }
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(KEY, value) } catch { /* storage may be unavailable */ }
  }
}, { immediate: true })

export function useLanguagePreference() {
  return { language, languageOptions }
}
