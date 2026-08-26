import { readStorage, removeStorage, writeStorage } from './storage'

export type MatchCombatDisposition = '' | 'won' | 'lost' | 'draw'

export type MatchTurnUnitState = {
  chargeDeclared?: boolean
  chargeHeld?: boolean
  chargeSuccessful?: boolean
  chargeReaction?: 'hold' | 'stand-shoot' | 'flee' | 'counter-charge' | ''
  compulsoryMoved?: boolean
  remainingMoved?: boolean
  remainingMoveMode?: 'normal' | 'march' | 'hold' | ''
  combatDisposition?: MatchCombatDisposition
  combatLostBy?: number
  breakResult?: string
  followUpResult?: string
}

export type MatchPersistentUnitState = {
  casualties?: number
  bannerLost?: boolean
  championLost?: boolean
  musicianLost?: boolean
}

export type MatchTrackingState = {
  version: 2
  joinedCharacters: Record<string, string>
  turns: Record<string, Record<string, MatchTurnUnitState>>
  /** Persistent model loss/wounds and command-model state across all turns/rounds. */
  units: Record<string, MatchPersistentUnitState>
  workflowMigrated?: boolean
  tipsHidden?: boolean
  collapsedTips?: Record<string, boolean>
  fatedDispelUsedRound?: number
}

const PREFIX = 'olddex.match-tracking.v036.'

type LegacyTurnUnitState = Omit<MatchTurnUnitState, 'combatDisposition'> & {
  combatDisposition?: MatchCombatDisposition | 'failed-break'
  destroyedModels?: number
  bannerLost?: boolean
  championLost?: boolean
  musicianLost?: boolean
}

function emptyState(): MatchTrackingState {
  return { version: 2, joinedCharacters: {}, turns: {}, units: {} }
}

function normalizeState(value: unknown): MatchTrackingState {
  if (!value || typeof value !== 'object') return emptyState()
  const row = value as Partial<MatchTrackingState> & { version?: number }
  const joinedCharacters: Record<string, string> = {}
  if (row.joinedCharacters && typeof row.joinedCharacters === 'object') {
    for (const [characterId, hostId] of Object.entries(row.joinedCharacters)) {
      if (characterId && typeof hostId === 'string' && hostId) joinedCharacters[characterId] = hostId
    }
  }

  const units: Record<string, MatchPersistentUnitState> = {}
  if (row.units && typeof row.units === 'object') {
    for (const [unitId, state] of Object.entries(row.units)) {
      if (!state || typeof state !== 'object') continue
      const source = state as MatchPersistentUnitState
      units[unitId] = {
        casualties: Math.max(0, Math.floor(Number(source.casualties || 0))),
        bannerLost: Boolean(source.bannerLost),
        championLost: Boolean(source.championLost),
        musicianLost: Boolean(source.musicianLost),
      }
    }
  }

  const turns: Record<string, Record<string, MatchTurnUnitState>> = {}
  if (row.turns && typeof row.turns === 'object') {
    for (const [turnKey, turnUnits] of Object.entries(row.turns)) {
      if (!turnUnits || typeof turnUnits !== 'object') continue
      turns[turnKey] = {}
      for (const [unitId, state] of Object.entries(turnUnits)) {
        if (!state || typeof state !== 'object') continue
        const source = state as LegacyTurnUnitState
        const disposition: MatchCombatDisposition = source.combatDisposition === 'won' || source.combatDisposition === 'draw'
          ? source.combatDisposition
          : source.combatDisposition === 'lost' || source.combatDisposition === 'failed-break'
            ? 'lost'
            : ''
        turns[turnKey][unitId] = {
          chargeDeclared: Boolean(source.chargeDeclared),
          chargeHeld: Boolean(source.chargeHeld),
          chargeSuccessful: Boolean(source.chargeSuccessful),
          chargeReaction: ['hold', 'stand-shoot', 'flee', 'counter-charge'].includes(String(source.chargeReaction)) ? source.chargeReaction : '',
          compulsoryMoved: Boolean(source.compulsoryMoved),
          remainingMoved: Boolean(source.remainingMoved),
          remainingMoveMode: ['normal', 'march', 'hold'].includes(String(source.remainingMoveMode)) ? source.remainingMoveMode : '',
          combatDisposition: disposition,
          combatLostBy: Math.max(0, Math.floor(Number(source.combatLostBy || 0))),
          breakResult: typeof source.breakResult === 'string' ? source.breakResult : '',
          followUpResult: typeof source.followUpResult === 'string' ? source.followUpResult : '',
        }

        // Migrate the old per-turn casualty/command state into one persistent
        // unit record. Taking the highest casualty count and OR-ing command
        // losses preserves the most advanced state from existing matches.
        const legacyCasualties = Math.max(0, Math.floor(Number(source.destroyedModels || 0)))
        const prior = units[unitId] || {}
        units[unitId] = {
          casualties: Math.max(Number(prior.casualties || 0), legacyCasualties),
          bannerLost: Boolean(prior.bannerLost || source.bannerLost),
          championLost: Boolean(prior.championLost || source.championLost),
          musicianLost: Boolean(prior.musicianLost || source.musicianLost),
        }
      }
    }
  }

  const collapsedTips: Record<string, boolean> = {}
  if (row.collapsedTips && typeof row.collapsedTips === 'object') {
    for (const [key, val] of Object.entries(row.collapsedTips)) if (key && val) collapsedTips[key] = true
  }

  return {
    version: 2,
    joinedCharacters,
    turns,
    units,
    workflowMigrated: Boolean(row.workflowMigrated),
    tipsHidden: Boolean(row.tipsHidden),
    collapsedTips,
    fatedDispelUsedRound: Math.max(0, Math.floor(Number(row.fatedDispelUsedRound || 0))) || undefined,
  }
}

export function loadMatchTracking(gameId: string): MatchTrackingState {
  if (!gameId) return emptyState()
  const raw = readStorage(`${PREFIX}${gameId}`)
  if (!raw) return emptyState()
  try { return normalizeState(JSON.parse(raw)) }
  catch { return emptyState() }
}

export function saveMatchTracking(gameId: string, state: MatchTrackingState) {
  if (!gameId) return false
  return writeStorage(`${PREFIX}${gameId}`, JSON.stringify(normalizeState(state)))
}

export function clearMatchTracking(gameId: string) {
  if (!gameId) return false
  return removeStorage(`${PREFIX}${gameId}`)
}
