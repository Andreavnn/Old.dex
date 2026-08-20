import type { ProfileKey, RuleTone } from '../data/builderPrototype'
import type { RawBuilderUnit } from './rawArmyData'
import { isRecord } from './schemas'

export const blankProfile = (): Record<ProfileKey, string> => ({ M: '—', WS: '—', BS: '—', S: '—', T: '—', W: '—', I: '—', A: '—', Ld: '—', Sv: '—', Ward: '—', Rn: '—' })

export function text(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('; ')
  if (!isRecord(value)) return String(value)
  return String(value.name_en || value.name || value.text_en || value.text || '')
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function noteText(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value)) return value.map(noteText).filter(Boolean).join(' • ')
  if (isRecord(value)) return String(value.name_en || value.name || '')
  return String(value)
}

export function minimumModels(raw: RawBuilderUnit) {
  const minimum = Number(raw.minimum || 0)
  return Number.isFinite(minimum) && minimum > 0 ? minimum : 1
}

export function maximumModels(raw: RawBuilderUnit) {
  const maximum = Number(raw.maximum || 0)
  return Number.isFinite(maximum) && maximum > 0 ? maximum : undefined
}

export function baseUnitSize(raw: RawBuilderUnit) {
  const minimum = minimumModels(raw)
  const maximum = Number(raw.maximum || 0)
  const explicitMinimum = raw.minimum !== undefined && raw.minimum !== null && Number(raw.minimum) > 0
  if (maximum === 1) return '1 model'
  if (maximum > 0) return `${minimum}–${maximum} models`
  if (!explicitMinimum && minimum === 1) return '1 model'
  return `${minimum}+ models`
}

export function specialRuleTone(name: string): RuleTone {
  const n = name.toLowerCase()
  if (/waaagh|rallying cry|command|reserve move/.test(n)) return 'strategy'
  if (/fly|swiftstride|vanguard|ambush|scout|move through cover|chariot runners/.test(n)) return 'movement'
  if (/fire & flee|fire and flee|move & shoot|move and shoot|quick shot|shoot/.test(n)) return 'shooting'
  if (/frenzy|furious charge|impact hits|stomp|choppas|first charge|tusker|strike|armour bane|killing blow|lance/.test(n)) return 'combat'
  if (/wizard|spell|magic|lore/.test(n)) return 'magic'
  if (/counter charge|terror|fear|panic/.test(n)) return 'reaction'
  return 'passive'
}

export function phaseLabel(tone: RuleTone) {
  return ({ strategy: 'Strategy Phase', movement: 'Movement', shooting: 'Shooting', combat: 'Combat', magic: 'Magic', reaction: 'Reaction', passive: 'Passive' } as const)[tone]
}
