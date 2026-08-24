import { readStorage, removeStorage, writeStorage } from './storage'

export type MatchCombatDisposition = '' | 'won' | 'failed-break'

export type MatchTurnUnitStateV036 = {
  chargeDeclared?: boolean
  chargeResolved?: boolean
  compulsoryMoved?: boolean
  remainingMoved?: boolean
  destroyedModels?: number
  bannerLost?: boolean
  championLost?: boolean
  musicianLost?: boolean
  combatDisposition?: MatchCombatDisposition
  breakResult?: string
  followUpResult?: string
}

export type MatchTrackingStateV036 = {
  version: 1
  joinedCharacters: Record<string, string>
  turns: Record<string, Record<string, MatchTurnUnitStateV036>>
  workflowMigrated?: boolean
}

const PREFIX = 'olddex.match-tracking.v036.'

function emptyState(): MatchTrackingStateV036 {
  return { version: 1, joinedCharacters: {}, turns: {} }
}

function normalizeState(value: unknown): MatchTrackingStateV036 {
  if (!value || typeof value !== 'object') return emptyState()
  const row = value as Partial<MatchTrackingStateV036>
  const joinedCharacters: Record<string, string> = {}
  if (row.joinedCharacters && typeof row.joinedCharacters === 'object') {
    for (const [characterId, hostId] of Object.entries(row.joinedCharacters)) {
      if (characterId && typeof hostId === 'string' && hostId) joinedCharacters[characterId] = hostId
    }
  }
  const turns: Record<string, Record<string, MatchTurnUnitStateV036>> = {}
  if (row.turns && typeof row.turns === 'object') {
    for (const [turnKey, units] of Object.entries(row.turns)) {
      if (!units || typeof units !== 'object') continue
      turns[turnKey] = {}
      for (const [unitId, state] of Object.entries(units)) {
        if (!state || typeof state !== 'object') continue
        const source = state as MatchTurnUnitStateV036
        turns[turnKey][unitId] = {
          chargeDeclared: Boolean(source.chargeDeclared),
          chargeResolved: Boolean(source.chargeResolved),
          compulsoryMoved: Boolean(source.compulsoryMoved),
          remainingMoved: Boolean(source.remainingMoved),
          destroyedModels: Math.max(0, Math.floor(Number(source.destroyedModels || 0))),
          bannerLost: Boolean(source.bannerLost),
          championLost: Boolean(source.championLost),
          musicianLost: Boolean(source.musicianLost),
          combatDisposition: source.combatDisposition === 'won' || source.combatDisposition === 'failed-break' ? source.combatDisposition : '',
          breakResult: typeof source.breakResult === 'string' ? source.breakResult : '',
          followUpResult: typeof source.followUpResult === 'string' ? source.followUpResult : '',
        }
      }
    }
  }
  return { version: 1, joinedCharacters, turns, workflowMigrated: Boolean(row.workflowMigrated) }
}

export function loadMatchTrackingV036(gameId: string): MatchTrackingStateV036 {
  if (!gameId) return emptyState()
  const raw = readStorage(`${PREFIX}${gameId}`)
  if (!raw) return emptyState()
  try {
    return normalizeState(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

export function saveMatchTrackingV036(gameId: string, state: MatchTrackingStateV036) {
  if (!gameId) return false
  return writeStorage(`${PREFIX}${gameId}`, JSON.stringify(normalizeState(state)))
}

export function clearMatchTrackingV036(gameId: string) {
  if (!gameId) return false
  return removeStorage(`${PREFIX}${gameId}`)
}
