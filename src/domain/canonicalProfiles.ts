import type { ProfileKey } from '../data/builderPrototype'
import type { OwbRuleIndexEntry, OwbRuleIndexStat } from '../services/owbRuleResolver'

export const BASE_PROFILE_KEYS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const
export const SAVE_PROFILE_KEYS = ['Sv', 'Ward', 'Rn'] as const
export type BaseProfileKey = typeof BASE_PROFILE_KEYS[number]
export type SaveProfileKey = typeof SAVE_PROFILE_KEYS[number]
export type ProfileSourceKind = 'owb-index' | 'rules-page' | 'builder-raw' | 'custom-data'

export type CanonicalProfileIdentity = {
  factionId: string
  compositionId: string
  rosterUnitId: string
  rulesPath: string
  profileId: string
  source: ProfileSourceKind
}

export type CanonicalProfileRow = {
  name: string
  profile: Record<ProfileKey, string>
  identity: CanonicalProfileIdentity
}

export type ProfileIdentityContext = {
  factionId: string
  compositionId: string
  rosterUnitId: string
  rulesPath: string
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizedProfileIdentityName(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function profileId(value: string, index: number) {
  const id = normalizedProfileIdentityName(value).replace(/\s+/g, '-')
  return id || `profile-${index + 1}`
}

function baseProfileFromRecord(row: Record<string, unknown>) {
  const profile = {} as Record<ProfileKey, string>
  for (const key of BASE_PROFILE_KEYS) {
    const value = row[key]
    if (value === undefined || value === null || clean(value) === '') return null
    profile[key] = clean(value)
  }
  const save = row.Sv ?? row.Save
  const ward = row.Ward ?? row.Wd
  const regen = row.Rn ?? row.Regen
  profile.Sv = save === undefined || save === null || clean(save) === '' ? '—' : clean(save)
  profile.Ward = ward === undefined || ward === null || clean(ward) === '' ? '—' : clean(ward)
  profile.Rn = regen === undefined || regen === null || clean(regen) === '' ? '—' : clean(regen)
  return profile
}

export function canonicalOwbProfileRows(
  entry: OwbRuleIndexEntry | undefined,
  fallbackName: string,
  context: ProfileIdentityContext,
): CanonicalProfileRow[] {
  const stats = Array.isArray(entry?.stats) ? entry!.stats!.filter((row) => row && typeof row === 'object') : []
  const rows: CanonicalProfileRow[] = []
  const seen = new Set<string>()
  stats.forEach((raw, index) => {
    const profile = baseProfileFromRecord(raw as OwbRuleIndexStat)
    if (!profile) return
    const name = clean((raw as OwbRuleIndexStat).Name) || fallbackName
    const id = profileId(name, index)
    const dedupe = `${id}|${BASE_PROFILE_KEYS.map((key) => profile[key]).join('|')}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    rows.push({
      name,
      profile,
      identity: {
        ...context,
        profileId: id,
        source: 'owb-index',
      },
    })
  })
  return rows
}

export function selectCanonicalPrimaryProfile<T extends { name: string }>(
  rows: readonly T[],
  identifiers: readonly string[],
): T | null {
  if (!rows.length) return null
  const wanted = new Set(identifiers.map(normalizedProfileIdentityName).filter(Boolean))
  const exact = rows.filter((row) => wanted.has(normalizedProfileIdentityName(row.name)))
  if (exact.length === 1) return exact[0]
  if (rows.length === 1) return rows[0]
  return null
}

export function strictProfileRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return baseProfileFromRecord(value as Record<string, unknown>)
}

export function persistentModelCharacteristicModifiers(value: string) {
  const out: Partial<Record<ProfileKey, number>> = {}
  const labels: Array<[ProfileKey, string]> = [
    ['M', 'Movement|M'],
    ['WS', 'Weapon\\s+Skill|WS'],
    ['BS', 'Ballistic\\s+Skill|BS'],
    ['S', 'Strength|S'],
    ['T', 'Toughness|T'],
    ['W', 'Wounds?|W'],
    ['I', 'Initiative|I'],
    ['A', 'Attacks?|A'],
    ['Ld', 'Leadership|Ld'],
  ]
  const sentences = String(value || '')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;])\s+/)
    .map((row) => row.trim())
    .filter(Boolean)

  const contextual = /\b(?:until|during|for the remainder of (?:this|the) (?:turn|phase|round)|this (?:turn|phase|round)|when|whenever|while|whilst|if|after|before|charge|charging|combat|shooting|using|uses?|wielding|weapon|attack|to hit|to wound)\b/i
  const apply = (key: ProfileKey, amountValue: string | number) => {
    const amount = Math.max(0, Number(amountValue) || 0)
    if (amount) out[key] = Math.max(out[key] || 0, amount)
  }

  for (const sentence of sentences) {
    if (contextual.test(sentence)) continue

    for (const match of sentence.matchAll(/\+(\d+)\s+(?:modifier|bonus)\s+to\s+(?:(?:their|its|the model's|the unit's)\s+)?([^.;!?]{1,120}?)\s+characteristics?\b/gi)) {
      for (const [key, label] of labels) {
        if (new RegExp(`\\b(?:${label})\\b`, 'i').test(match[2])) apply(key, match[1])
      }
    }

    for (const [key, label] of labels) {
      const patterns = [
        new RegExp(`\\+(\\d+)\\s*(?:modifier|bonus)?\\s*(?:to\\s+)?(?:(?:their|its|the model's|the unit's)\\s+)?(?:${label})(?:\\s+characteristic)?\\b`, 'i'),
        new RegExp(`(?:${label})(?:\\s+characteristic)?\\s+(?:is|are)\\s+(?:permanently\\s+)?(?:increased|improved|raised)\\s+(?:by\\s+)?\\+?(\\d+)\\b`, 'i'),
        new RegExp(`(?:increase|improve|raise)s?\\s+(?:(?:their|its|the model's|the unit's)\\s+)?(?:${label})(?:\\s+characteristic)?\\s+(?:by\\s+)?\\+?(\\d+)\\b`, 'i'),
        new RegExp(`(?:gains?|receives?|has|have)\\s+(?:a\\s+)?\\+(\\d+)\\s*(?:modifier|bonus)?\\s*(?:to\\s+)?(?:(?:their|its|the model's|the unit's)\\s+)?(?:${label})(?:\\s+characteristic)?\\b`, 'i'),
      ]
      for (const pattern of patterns) {
        const match = sentence.match(pattern)
        if (match) apply(key, match[1])
      }
    }
  }

  return out
}

export function saveOnlyProfileOverride(
  override: Partial<Record<ProfileKey, string>> | undefined,
) {
  const out: Partial<Record<ProfileKey, string>> = {}
  if (!override) return out
  for (const key of SAVE_PROFILE_KEYS) {
    const value = override[key]
    if (value !== undefined) out[key] = String(value)
  }
  return out
}
