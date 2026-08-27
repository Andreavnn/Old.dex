import type { ProfileKey } from '../data/builderPrototype'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { incrementCharacteristic, isMountProfileName, normalizedModelName } from '../domain/profileEffects'
import { persistentModelCharacteristicModifiers } from '../domain/canonicalProfiles'
import { resolveArmourSave } from '../core/profileMath'
import type { SavedGame } from './games'
import { loadMagicItemReference } from './magicItemReference'
import { loadMatchUnitProfile, type MatchUnitProfileSnapshot } from './matchUnitProfiles'

type MatchMagicProfileEffect = {
  ownerId: string
  ownerLabel: string
  shield: boolean
  override: Partial<Record<ProfileKey, string | number>>
}

function effectApplies(effect: MatchMagicProfileEffect, profileName: string) {
  if (effect.ownerId === 'unit' || !effect.ownerId) return !isMountProfileName(profileName)
  const profile = normalizedModelName(profileName)
  const owner = normalizedModelName(effect.ownerLabel)
  return Boolean(owner && (profile.includes(owner) || owner.includes(profile)))
}

async function selectedMagicProfileEffects(rosterRow: BuilderRosterSelection) {
  const effects: MatchMagicProfileEffect[] = []
  await Promise.allSettled((rosterRow.magicItems || []).map(async (item) => {
    let body = ''
    if (item.slug) {
      try {
        const reference = await loadMagicItemReference({ name: item.name, type: item.type, itemPath: `/magic-item/${item.slug}` })
        body = `${reference.bodyText || ''} ${reference.summary || ''}`.replace(/\s+/g, ' ').trim()
      } catch {
        body = ''
      }
    }

    const override: Partial<Record<ProfileKey, string | number>> = {}
    const armour = body.match(/(?:armour save(?: of)?|gains? (?:an? )?)(2\+|3\+|4\+|5\+|6\+)(?: armour save)?/i)
      || body.match(/\b(2\+|3\+|4\+|5\+|6\+)\s+armour save\b/i)
    if (armour) override.Sv = armour[1]
    const ward = body.match(/(?:Ward\s+save(?:\s+of)?\s*\(?\s*(2\+|3\+|4\+|5\+|6\+)\s*\)?|(2\+|3\+|4\+|5\+|6\+)\s+Ward\s+save)/i)
    if (ward) override.Ward = ward[1] || ward[2]
    const regeneration = body.match(/Regeneration\s*\(?\s*([2-6]\+)\s*\)?/i)
    if (regeneration) override.Rn = regeneration[1]
    const persistent = persistentModelCharacteristicModifiers(body)
    for (const [key, amount] of Object.entries(persistent) as Array<[ProfileKey, number]>) override[key] = amount

    effects.push({
      ownerId: String(item.ownerId || 'unit'),
      ownerLabel: String(item.ownerLabel || rosterRow.name),
      shield: item.type === 'armor' && /\bshield\b/i.test(`${item.name} ${body}`),
      override,
    })
  }))
  return effects
}

function applyMagicProfileEffects(profileName: string, rawProfile: Record<string, string>, effects: MatchMagicProfileEffect[]) {
  const profile = { ...rawProfile } as Record<ProfileKey, string>
  let armourReplacement: string | undefined
  let shieldModifiers = 0

  for (const effect of effects) {
    if (!effectApplies(effect, profileName)) continue
    if (effect.shield) shieldModifiers += 1
    for (const [key, rawValue] of Object.entries(effect.override) as Array<[ProfileKey, string | number]>) {
      if (key === 'Sv') { armourReplacement = String(rawValue); continue }
      if (key === 'Ward' || key === 'Rn') { profile[key] = String(rawValue); continue }
      const amount = Number(rawValue)
      if (Number.isFinite(amount) && amount) profile[key] = incrementCharacteristic(profile[key] || '—', amount)
    }
  }

  if (armourReplacement || shieldModifiers) {
    profile.Sv = resolveArmourSave(profile.Sv || '—', armourReplacement, Array.from({ length: shieldModifiers }, () => 1))
  }
  return profile
}

export async function loadMatchRosterProfile(game: SavedGame, rosterRow: BuilderRosterSelection): Promise<MatchUnitProfileSnapshot | null> {
  const base = await loadMatchUnitProfile(game, rosterRow)
  if (!base) return null
  const effects = await selectedMagicProfileEffects(rosterRow)
  if (!effects.length) return base
  return {
    ...base,
    rows: base.rows.map((row) => ({ ...row, profile: applyMagicProfileEffects(row.name, row.profile, effects) })),
  }
}

export type { MatchUnitProfileSnapshot } from './matchUnitProfiles'
