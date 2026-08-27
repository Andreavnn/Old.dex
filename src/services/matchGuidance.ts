import type { BuilderRosterSelection } from '../domain/rosterTypes'
import type { GameSide, SavedGame } from './games'
import { getSavedArmyList } from './savedLists'
import { fetchRuleDocument } from './ruleContent'
import { extractMechanicalRuleText } from './ruleText'
import { loadMagicItemReference } from './magicItemReference'
import { chargeRangeContribution, formatMaximumDeclarationRange, type ChargeRangeContribution } from '../core/matchEffects'
import { extractMatchUseLimit, type MatchUseScope } from '../core/matchUsage'
import { loadMatchRosterProfile } from './matchRosterProfiles'
import {
  loadMatchDeploymentGuidance as loadBaseDeploymentGuidance,
  loadMatchStartRoundGuidance as loadBaseStartRoundGuidance,
  loadMatchTurnGuidance as loadBaseTurnGuidance,
  type MatchDeploymentGuidance,
  type MatchGuidanceRule as BaseMatchGuidanceRule,
  type MatchStartRoundRule,
} from './matchIntelligence'

export type MatchGuidanceRule = BaseMatchGuidanceRule & {
  useScope?: MatchUseScope
  useLimit?: number
  useKey?: string
}

export type { MatchDeploymentGuidance, MatchStartRoundRule }

const ruleTextCache = new Map<string, Promise<string>>()

function activeRoster(game: SavedGame, side: GameSide) {
  if (side === 'player') return game.playerRoster?.length ? game.playerRoster : (getSavedArmyList(game.playerListId)?.roster || [])
  return game.opponentRoster?.length ? game.opponentRoster : (game.opponentListId ? getSavedArmyList(game.opponentListId)?.roster || [] : [])
}

function cleanRuleText(value: string) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function ruleText(path: string | undefined, fallback: string) {
  if (!path) return Promise.resolve(fallback)
  const cached = ruleTextCache.get(path)
  if (cached) return cached
  const pending = fetchRuleDocument(path)
    .then((document) => cleanRuleText(extractMechanicalRuleText(document.html) || fallback))
    .catch(() => fallback)
  ruleTextCache.set(path, pending)
  return pending
}

async function movementFor(game: SavedGame, row: BuilderRosterSelection) {
  const stored = Number(row.movement || 0)
  if (Number.isFinite(stored) && stored > 0) return stored
  try {
    const profile = await loadMatchRosterProfile(game, row)
    const values = (profile?.rows || [])
      .map((entry) => Number.parseInt(String(entry.profile.M || ''), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
    return values.length ? Math.max(...values) : 0
  } catch {
    return 0
  }
}

async function chargeContributions(row: BuilderRosterSelection) {
  const contributions: ChargeRangeContribution[] = []
  const seen = new Set<string>()

  for (const rule of row.specialRules || []) {
    const key = `rule:${rule.path || rule.label}`
    if (seen.has(key)) continue
    seen.add(key)
    const text = await ruleText(rule.path, rule.label)
    const contribution = chargeRangeContribution(rule.label, text)
    if (contribution) contributions.push(contribution)
  }

  for (const item of row.magicItems || []) {
    const key = `magic:${item.id || item.slug || item.name}`
    if (seen.has(key)) continue
    seen.add(key)
    let text = item.name
    if (item.slug && !Number(item.maximumChargeRangeBonus || 0)) {
      try {
        const reference = await loadMagicItemReference({ name: item.name, type: item.type, itemPath: `/magic-item/${item.slug}` })
        text = reference.bodyText || reference.summary || item.name
      } catch {
        text = item.name
      }
    }
    const contribution = chargeRangeContribution(item.name, text, Number(item.maximumChargeRangeBonus || 0), item.chargeRollModifier)
    if (contribution) contributions.push(contribution)
  }
  return contributions
}

async function repairChargeRows(game: SavedGame, rows: MatchGuidanceRule[]) {
  const roster = activeRoster(game, 'player')
  const rosterMap = new Map(roster.map((row) => [row.instanceId, row]))
  await Promise.all(rows.map(async (rule) => {
    if (rule.action !== 'declare-charge' || !rule.unitRefs?.length) return
    const repaired = await Promise.all(rule.unitRefs.map(async (ref) => {
      const rosterRow = rosterMap.get(ref.instanceId)
      if (!rosterRow) return ref
      const movement = await movementFor(game, rosterRow)
      const declaration = formatMaximumDeclarationRange(movement, await chargeContributions(rosterRow))
      return {
        ...ref,
        chargeRange: declaration.total ? `${declaration.total}"` : 'See Movement profile',
        chargeRangeNote: declaration.text,
      }
    }))
    rule.unitRefs = repaired
  }))
  return rows
}

function annotateUseLimits(rows: MatchGuidanceRule[]) {
  return rows.map((rule) => {
    let useLimit = extractMatchUseLimit(rule.summary || '', Number(rule.quantity || 1))
    if (!useLimit && /^Fated Dispel$/i.test(rule.label)) useLimit = { scope: 'round', limit: 1 }
    const useKey = `${rule.sourceKind}|${rule.source}|${rule.label}|${rule.path || ''}`.toLowerCase()
    return useLimit ? { ...rule, useScope: useLimit.scope, useLimit: useLimit.limit, useKey, remainingQuantity: useLimit.limit } : { ...rule, remainingQuantity: undefined }
  })
}

export async function loadMatchTurnGuidance(game: SavedGame, stepId: string, viewSide: GameSide): Promise<MatchGuidanceRule[]> {
  const rows = annotateUseLimits((await loadBaseTurnGuidance(game, stepId, viewSide)).map((row) => ({ ...row })))
  return stepId === 'declare-charges' && viewSide === 'player' ? repairChargeRows(game, rows) : rows
}

export function loadMatchStartRoundGuidance(game: SavedGame) {
  return loadBaseStartRoundGuidance(game)
}

export function loadMatchDeploymentGuidance(game: SavedGame) {
  return loadBaseDeploymentGuidance(game)
}
