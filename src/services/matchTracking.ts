import { readStorage, removeStorage, writeStorage } from './storage'

export type MatchCombatDisposition = '' | 'won' | 'lost' | 'draw'

export type MatchTurnUnitState = {
  chargeDeclared?: boolean
  chargeHeld?: boolean
  chargeSuccessful?: boolean
  inCombat?: boolean
  chargeReaction?: 'hold' | 'stand-shoot' | 'flee' | 'counter-charge' | ''
  compulsoryMoved?: boolean
  remainingMoved?: boolean
  remainingMoveMode?: 'normal' | 'march' | 'hold' | ''
  combatDisposition?: MatchCombatDisposition
  combatLostBy?: number
  breakResult?: string
  followUpResult?: string
  pursuedOffTable?: boolean
  shootingPenaltyIds?: string[]
  rallyResult?: 'pass' | 'fail' | ''
}

export type MatchPersistentUnitState = {
  casualties?: number
  bannerLost?: boolean
  championLost?: boolean
  musicianLost?: boolean
  fleeing?: boolean
  fleeingSinceRound?: number
  pursuedOffTable?: boolean
  pursuedOffTableSinceRound?: number
  warMachineAbandoned?: boolean
}

export type MatchHistoryRow = {
  round: number
  side: 'player' | 'opponent'
  instanceId: string
  result: string
  detail?: string
}

export type MatchSpellCastState = {
  result?: 'success' | 'fail' | ''
  totalPower?: boolean
  miscast?: boolean
  miscastRoll?: string
  levelLoss?: number
  forgottenSpellIds?: string[]
  phaseId?: string
}

export type MatchWizardPersistentState = {
  levelLost?: number
  forgottenSpellIds?: string[]
}

export type MatchWizardTurnState = {
  cannotCast?: boolean
  cannotCastReason?: string
  scope?: 'phase' | 'turn'
  phaseId?: string
}

export type MatchTrackingState = {
  version: 5
  joinedCharacters: Record<string, string>
  turns: Record<string, Record<string, MatchTurnUnitState>>
  units: Record<string, MatchPersistentUnitState>
  ruleUses: Record<string, Record<string, number>>
  chargeHistory: MatchHistoryRow[]
  combatHistory: MatchHistoryRow[]
  spellCasts: Record<string, MatchSpellCastState>
  wizards: Record<string, MatchWizardPersistentState>
  wizardTurns: Record<string, Record<string, MatchWizardTurnState>>
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
  return { version: 5, joinedCharacters: {}, turns: {}, units: {}, ruleUses: {}, chargeHistory: [], combatHistory: [], spellCasts: {}, wizards: {}, wizardTurns: {} }
}

function normalizeHistory(value: unknown): MatchHistoryRow[] {
  if (!Array.isArray(value)) return []
  return value.filter((row) => row && typeof row === 'object').map((raw): MatchHistoryRow => {
    const row = raw as Partial<MatchHistoryRow>
    return {
      round: Math.max(1, Math.floor(Number(row.round || 1))),
      side: row.side === 'opponent' ? 'opponent' : 'player',
      instanceId: String(row.instanceId || ''),
      result: String(row.result || ''),
      detail: row.detail ? String(row.detail) : undefined,
    }
  }).filter((row) => row.instanceId && row.result).slice(-500)
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
        fleeing: Boolean(source.fleeing),
        fleeingSinceRound: Math.max(0, Math.floor(Number(source.fleeingSinceRound || 0))) || undefined,
        pursuedOffTable: Boolean(source.pursuedOffTable),
        pursuedOffTableSinceRound: Math.max(0, Math.floor(Number(source.pursuedOffTableSinceRound || 0))) || undefined,
        warMachineAbandoned: Boolean(source.warMachineAbandoned),
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
          inCombat: Boolean(source.inCombat),
          chargeReaction: ['hold', 'stand-shoot', 'flee', 'counter-charge'].includes(String(source.chargeReaction)) ? source.chargeReaction : '',
          compulsoryMoved: Boolean(source.compulsoryMoved),
          remainingMoved: Boolean(source.remainingMoved),
          remainingMoveMode: ['normal', 'march', 'hold'].includes(String(source.remainingMoveMode)) ? source.remainingMoveMode : '',
          combatDisposition: disposition,
          combatLostBy: Math.max(0, Math.floor(Number(source.combatLostBy || 0))),
          breakResult: typeof source.breakResult === 'string' ? source.breakResult : '',
          followUpResult: typeof source.followUpResult === 'string' ? source.followUpResult : '',
          pursuedOffTable: Boolean(source.pursuedOffTable),
          shootingPenaltyIds: Array.isArray(source.shootingPenaltyIds) ? [...new Set(source.shootingPenaltyIds.map(String).filter(Boolean))] : [],
          rallyResult: source.rallyResult === 'pass' || source.rallyResult === 'fail' ? source.rallyResult : '',
        }

        const legacyCasualties = Math.max(0, Math.floor(Number(source.destroyedModels || 0)))
        const prior = units[unitId] || {}
        units[unitId] = {
          ...prior,
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

  const ruleUses: Record<string, Record<string, number>> = {}
  if (row.ruleUses && typeof row.ruleUses === 'object') {
    for (const [ruleId, buckets] of Object.entries(row.ruleUses)) {
      if (!buckets || typeof buckets !== 'object') continue
      const normalized: Record<string, number> = {}
      for (const [bucket, count] of Object.entries(buckets)) {
        const countValue = Math.max(0, Math.floor(Number(count || 0)))
        if (countValue) normalized[bucket] = countValue
      }
      if (Object.keys(normalized).length) ruleUses[ruleId] = normalized
    }
  }

  const spellCasts: Record<string, MatchSpellCastState> = {}
  if (row.spellCasts && typeof row.spellCasts === 'object') {
    for (const [key, raw] of Object.entries(row.spellCasts)) {
      if (!key || !raw || typeof raw !== 'object') continue
      const source = raw as MatchSpellCastState
      const result = source.result === 'success' || source.result === 'fail' ? source.result : ''
      const miscastRoll = String(source.miscastRoll || '').trim()
      const levelLoss = Math.max(0, Math.floor(Number(source.levelLoss || 0)))
      const forgottenSpellIds = Array.isArray(source.forgottenSpellIds) ? [...new Set(source.forgottenSpellIds.map(String).filter(Boolean))] : []
      spellCasts[key] = { result, totalPower: Boolean(source.totalPower), miscast: Boolean(source.miscast || source.totalPower), miscastRoll: miscastRoll || undefined, levelLoss: levelLoss || undefined, forgottenSpellIds, phaseId: source.phaseId ? String(source.phaseId) : undefined }
    }
  }

  const wizards: Record<string, MatchWizardPersistentState> = {}
  if (row.wizards && typeof row.wizards === 'object') {
    for (const [id, raw] of Object.entries(row.wizards)) {
      if (!id || !raw || typeof raw !== 'object') continue
      const source = raw as MatchWizardPersistentState
      wizards[id] = { levelLost: Math.max(0, Math.floor(Number(source.levelLost || 0))) || undefined, forgottenSpellIds: Array.isArray(source.forgottenSpellIds) ? [...new Set(source.forgottenSpellIds.map(String).filter(Boolean))] : [] }
    }
  }

  const wizardTurns: Record<string, Record<string, MatchWizardTurnState>> = {}
  if (row.wizardTurns && typeof row.wizardTurns === 'object') {
    for (const [turnKey, rawTurn] of Object.entries(row.wizardTurns)) {
      if (!turnKey || !rawTurn || typeof rawTurn !== 'object') continue
      wizardTurns[turnKey] = {}
      for (const [id, raw] of Object.entries(rawTurn)) {
        if (!id || !raw || typeof raw !== 'object') continue
        const source = raw as MatchWizardTurnState
        wizardTurns[turnKey][id] = { cannotCast: Boolean(source.cannotCast), cannotCastReason: source.cannotCastReason ? String(source.cannotCastReason) : undefined, scope: source.scope === 'phase' ? 'phase' : source.scope === 'turn' ? 'turn' : undefined, phaseId: source.phaseId ? String(source.phaseId) : undefined }
      }
    }
  }

  return {
    version: 5,
    joinedCharacters,
    turns,
    units,
    ruleUses,
    chargeHistory: normalizeHistory(row.chargeHistory),
    combatHistory: normalizeHistory(row.combatHistory),
    spellCasts,
    wizards,
    wizardTurns,
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
