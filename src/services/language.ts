import { ref, watch } from 'vue'
import { readStorage, writeStorage } from './storage'

export type OldDexLanguage = 'en' | 'de' | 'fr' | 'es' | 'it' | 'pl' | 'zh'

export const languageOptions: Array<{ code: OldDexLanguage; label: string; short: string; sourceCode: string }> = [
  { code: 'en', label: 'English', short: 'EN', sourceCode: 'en' },
  { code: 'de', label: 'Deutsch', short: 'DE', sourceCode: 'de' },
  { code: 'fr', label: 'Français', short: 'FR', sourceCode: 'fr' },
  { code: 'es', label: 'Español', short: 'ES', sourceCode: 'es' },
  { code: 'it', label: 'Italiano', short: 'IT', sourceCode: 'it' },
  { code: 'pl', label: 'Polski', short: 'PL', sourceCode: 'pl' },
  { code: 'zh', label: '中文', short: '中文', sourceCode: 'cn' },
]

const KEY = 'olddex.language.v2'
function initialLanguage(): OldDexLanguage {
  const stored = (readStorage(KEY) || readStorage('olddex.language.v1')) as OldDexLanguage | null
  return languageOptions.some((option) => option.code === stored) ? stored! : 'en'
}

const language = ref<OldDexLanguage>(initialLanguage())
watch(language, (value) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value === 'zh' ? 'zh-CN' : value
    document.documentElement.dataset.language = value
  }
  writeStorage(KEY, value)
}, { immediate: true })

export function currentOldDexLanguage() { return language.value }
export function sourceLanguageCode(value: OldDexLanguage = language.value) { return languageOptions.find((option) => option.code === value)?.sourceCode || 'en' }

export function localizedSourceText(value: unknown, lang: OldDexLanguage = language.value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  const row = value as Record<string, unknown>
  const code = sourceLanguageCode(lang)
  const candidates = [row[`name_${code}`], row[`text_${code}`], row.name_en, row.text_en, row.name, row.text]
  const found = candidates.find((candidate) => typeof candidate === 'string' || typeof candidate === 'number')
  return found === undefined ? '' : String(found).trim()
}

export function useLanguagePreference() {
  return { language, languageOptions }
}
