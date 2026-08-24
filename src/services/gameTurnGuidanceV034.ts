import { loadLiveUnitProfile } from '../data/liveBuilderUnits'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { extractMechanicalRuleText } from './ruleText'
import { fetchRuleDocument } from './ruleContent'
import { getSavedArmyList } from './savedLists'
import {
  loadTurnStepGuidance as loadBaseTurnStepGuidance,
  randomHappeningOptions,
} from './gameSetup'
import type { SavedGame } from './games'

export type GameTurnUnitRefV034 = {
  instanceId: string
  name: string
  chargeRange?: string
  chargeRangeNote?: string
}

export type GameTurnRuleV034 = {
  side: 'player' | 'battle'
  source: string
  label: string
  path?: string
  summary: string
  unitRefs?: GameTurnUnitRefV034[]
  action?: 'rule' | 'declare-charge' | 'spell' | 'required-charge-test'
  requiredCharge?: boolean
}

const explicitStepPatterns: Array<[string, RegExp]> = [
  ['start-of-turn', /\b(?:during|in|at|from|until)\s+(?:your\s+|the\s+|each\s+|every\s+|a\s+)?(?:start|beginning) of (?:your\s+|the\s+|each\s+|every\s+|a\s+)?turn\b/i],
  ['command', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?command sub-?phase\b|\bcommand sub-?phase\b/i],
  ['conjuration', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?conjuration sub-?phase\b|\bconjuration sub-?phase\b/i],
  ['rally', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?(?:rally(?:ing fleeing troops)?|rallying fleeing units?) sub-?phase\b|\brallying fleeing troops sub-?phase\b/i],
  ['required-charges', /\brequired charge tests?\b|\bimpetuous tests?\b/i],
  ['declare-charges', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?declare charges? sub-?phase\b|\bdeclare charges? sub-?phase\b/i],
  ['charge-moves', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?charge moves? sub-?phase\b|\bcharge moves? sub-?phase\b/i],
  ['compulsory-moves', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?compulsory moves? sub-?phase\b|\bcompulsory moves? sub-?phase\b/i],
  ['remaining-moves', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?remaining moves? sub-?phase\b|\bremaining moves? sub-?phase\b/i],
  ['special-shooting', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?special shooting actions?\b/i],
  ['shooting', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?shooting phase\b/i],
  ['fight', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?(?:choose (?:and|&) fight combat|fight)\b|\bassailment\b/i],
  ['combat-result', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?calculate combat result\b|\bcombat result(?: step| sub-?phase)?\b/i],
  ['break-test', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?break tests?\b|\bbreak tests? step\b/i],
  ['follow-up', /\b(?:during|in|at)\s+(?:your\s+|the\s+)?follow up (?:and|&) pursuit\b|\bfollow up & pursuit\b/i],
  ['end-effects', /\b(?:at|during|in)\s+(?:your\s+|the\s+|each\s+|every\s+)?end of (?:the\s+)?round\b/i],
]

const semanticStepPatterns: Array<[string, RegExp]> = [
  // Tests that decide whether a unit must declare a charge belong before charge declarations.
  ['required-charges', /\bimpetuous\b/i],
  ['required-charges', /\b(?:leadership|ld)\s+test\b[^.]{0,180}\bmust\s+declare\s+a\s+charge\b|\btesting\b[^.]{0,180}\bmust\s+declare\s+a\s+charge\b/i],
  ['required-charges', /\btest(?:ing)?\b[^.]{0,160}\b(?:required|forced|must)\b[^.]{0,80}\bcharge\b/i],
  ['conjuration', /\b(?:enchantment|hex)\b/i],
  ['remaining-moves', /\bconveyance\b/i],
  ['special-shooting', /\b(?:magic missile|magical vortex)\b/i],
  ['fight', /\bassailment\b/i],
  ['combat-result', /\bcombat result\b/i],
  ['break-test', /\bbreak test\b/i],
  ['follow-up', /\b(?:pursuit|follow up|restrain)\b/i],
  ['rally', /\brally(?:ing)? test\b|\brally fleeing\b/i],
  ['command', /\bcommand\b/i],
  ['charge-moves', /\b(?:charge move|failed charge)\b/i],
  ['compulsory-moves', /\b(?:compulsory move|random movement|fleeing move|reserve arrival|reinforcement)\b/i],
  ['shooting', /\b(?:shooting attack|missile weapon)\b/i],
]

function ruleText(rule: Pick<GameTurnRuleV034, 'label' | 'summary'>) {
  return `${rule.label || ''} ${rule.summary || ''}`.replace(/\s+/g, ' ').trim()
}

function resolvedStepFromText(text: string) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''

  // Explicit named subphases always beat what the rule happens to do. This is
  // essential for rules such as Rallying Cry: it rallies a unit, but the rule
  // explicitly says it is used during the Command sub-phase.
  for (const [step, pattern] of explicitStepPatterns) if (pattern.test(clean)) return step
  for (const [step, pattern] of semanticStepPatterns) if (pattern.test(clean)) return step
  return ''
}

export function resolveTurnStepV034(text: string) { return resolvedStepFromText(text) }

function routeBaseRule(rule: GameTurnRuleV034, requestedStep: string) {
  if (rule.action === 'declare-charge') return requestedStep === 'declare-charges'
  // Small named-rule overrides are reserved for cases where a source transport
  // can truncate the timing sentence. The general text resolver remains the
  // primary routing system for the rest of the catalogue.
  if (/^Rallying Cry$/i.test(String(rule.label || '').trim())) return requestedStep === 'command'
  const resolved = resolvedStepFromText(ruleText(rule))
  return !resolved || resolved === requestedStep
}

function casterNames(game: SavedGame) {
  return new Set((game.magicSetup || []).map((row) => row.name.toLowerCase()))
}

function rosterForGame(game: SavedGame): BuilderRosterSelection[] {
  return game.playerRoster?.length ? game.playerRoster : (getSavedArmyList(game.playerListId)?.roster || [])
}

function gameArmySlug(game: SavedGame) {
  return game.playerArmyId || getSavedArmyList(game.playerListId)?.army || ''
}

function gameCompositionId(game: SavedGame) {
  return getSavedArmyList(game.playerListId)?.composition || ''
}

async function ruleSummary(path: string, fallback: string) {
  if (!path) return fallback
  try {
    const doc = await fetchRuleDocument(path)
    return extractMechanicalRuleText(doc.html) || fallback
  } catch {
    return fallback
  }
}

async function supplementalRosterRules(game: SavedGame, requestedStep: string, viewSide: 'player' | 'opponent'): Promise<GameTurnRuleV034[]> {
  if (viewSide !== 'player') return []
  const output: GameTurnRuleV034[] = []
  const jobs: Array<Promise<void>> = []

  for (const unit of rosterForGame(game)) {
    for (const rule of unit.specialRules || []) {
      if (!rule.path) continue
      jobs.push((async () => {
        const summary = await ruleSummary(rule.path, `${rule.label} applies when its source rule says to resolve it.`)
        const text = `${rule.label} ${summary}`
        if (resolvedStepFromText(text) !== requestedStep) return
        output.push({
          side: 'player',
          source: unit.name,
          label: rule.label,
          path: rule.path,
          summary,
          unitRefs: [{ instanceId: unit.instanceId, name: unit.name }],
          action: requestedStep === 'required-charges' ? 'required-charge-test' : undefined,
        } as GameTurnRuleV034)
      })())
    }
  }
  await Promise.allSettled(jobs)
  const grouped = new Map<string, GameTurnRuleV034>()
  for (const row of output) {
    const key = `${row.label}|${row.path || ''}|${row.summary}|${row.action || 'rule'}`.toLowerCase()
    const existing = grouped.get(key)
    if (!existing) { grouped.set(key, { ...row, unitRefs: [...(row.unitRefs || [])] }); continue }
    const refs = new Map((existing.unitRefs || []).map((ref) => [ref.instanceId, ref]))
    for (const ref of row.unitRefs || []) refs.set(ref.instanceId, ref)
    existing.unitRefs = [...refs.values()]
    existing.source = requestedStep === 'required-charges' ? 'Required Charge Test' : 'Affected units'
  }
  return [...grouped.values()]
}

async function supplementalScenarioRules(game: SavedGame, requestedStep: string): Promise<GameTurnRuleV034[]> {
  const guidance = game.scenarioGuidance
  if (!guidance?.scenarioRules?.length) return []
  return guidance.scenarioRules.flatMap((summary, index) => resolvedStepFromText(summary) === requestedStep ? [{
    side: 'battle' as const,
    source: game.scenario,
    label: guidance.scenarioRules.length > 1 ? `Scenario Rule ${index + 1}` : 'Scenario Rule',
    path: guidance.sourcePath,
    summary,
  } as GameTurnRuleV034] : [])
}

async function supplementalBattlefieldRules(game: SavedGame, requestedStep: string): Promise<GameTurnRuleV034[]> {
  const selected = new Set(game.battlefieldConditions || [])
  const output: GameTurnRuleV034[] = []
  await Promise.allSettled(randomHappeningOptions.filter((option) => selected.has(option.id)).map(async (option) => {
    const summary = await ruleSummary(option.path, option.label)
    if (resolvedStepFromText(`${option.label} ${summary}`) !== requestedStep) return
    output.push({ side: 'battle', source: 'Battlefield', label: option.label, path: option.path, summary } as GameTurnRuleV034)
  }))
  return output
}

function numericMovement(row: BuilderRosterSelection) {
  const stored = Number(row.movement || 0)
  return Number.isFinite(stored) && stored > 0 ? stored : 0
}

async function fallbackMovement(game: SavedGame, row: BuilderRosterSelection) {
  const stored = numericMovement(row)
  if (stored) return stored
  const armySlug = gameArmySlug(game)
  if (!armySlug) return 0
  try {
    const unit = await loadLiveUnitProfile(armySlug, game.playerArmyName, row.unitId, gameCompositionId(game))
    if (!unit) return 0
    const profiles = (unit.profiles?.length ? unit.profiles : [{ name: unit.name, profile: unit.profile }]) as Array<{ profile: Record<string, string> }>
    const values = profiles.map((profile: { profile: Record<string, string> }) => Number.parseInt(profile.profile.M || '', 10)).filter((value: number) => Number.isFinite(value) && value > 0)
    const selectedIds = new Set(row.equipmentIds || [])
    const optionalProfiles = (unit.optionalProfiles || []) as Array<{ selectionId?: string; profile: Record<string, string> }>
    const selectedOptional = optionalProfiles.filter((profile) => Boolean(profile.selectionId && selectedIds.has(profile.selectionId)))
    const optional = selectedOptional.map((profile) => Number.parseInt(profile.profile.M || '', 10)).filter((value: number) => Number.isFinite(value) && value > 0)
    return optional.length ? Math.max(...optional) : Math.max(0, ...values)
  } catch {
    return 0
  }
}

async function chargeRangeBonusFromRules(row: BuilderRosterSelection) {
  let bonus = (row.specialRules || []).some((rule) => /^Swiftstride(?:\s|$)/i.test(rule.label)) ? 3 : 0
  const seen = new Set<string>()
  const paths = [
    ...(row.specialRules || []).filter((rule) => !/^Swiftstride(?:\s|$)/i.test(rule.label)).map((rule) => rule.path),
    ...(row.magicItems || []).map((item) => item.slug ? `/magic-item/${item.slug}` : ''),
  ].filter(Boolean)
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    try {
      const doc = await fetchRuleDocument(path)
      const text = extractMechanicalRuleText(doc.html) || ''
      for (const match of text.matchAll(/(?:maximum possible charge range|charge range)[^.]{0,100}(?:increase(?:d)?|add)[^.]{0,50}(?:by\s+)?(\d+)/gi)) bonus += Math.max(0, Number(match[1]) || 0)
    } catch { /* base and Swiftstride range remain usable */ }
  }
  return bonus
}

async function enrichDeclareChargeRanges(game: SavedGame, rows: GameTurnRuleV034[]) {
  if (!rows.length) return rows
  const roster = rosterForGame(game)
  const byId = new Map(roster.map((row) => [row.instanceId, row]))
  const movementCache = new Map<string, Promise<number>>()
  const bonusCache = new Map<string, Promise<number>>()
  const movementFor = (row: BuilderRosterSelection) => {
    let value = movementCache.get(row.instanceId)
    if (!value) { value = fallbackMovement(game, row); movementCache.set(row.instanceId, value) }
    return value
  }
  const bonusFor = (row: BuilderRosterSelection) => {
    let value = bonusCache.get(row.instanceId)
    if (!value) { value = chargeRangeBonusFromRules(row); bonusCache.set(row.instanceId, value) }
    return value
  }

  return Promise.all(rows.map(async (rule) => {
    if (rule.action !== 'declare-charge' || !rule.unitRefs?.length) return rule
    const refs = await Promise.all(rule.unitRefs.map(async (ref) => {
      const rosterRow = byId.get(ref.instanceId)
      if (!rosterRow) return ref
      const movement = await movementFor(rosterRow)
      const bonus = await bonusFor(rosterRow)
      if (!movement) return { ...ref, chargeRange: 'See Movement profile', chargeRangeNote: 'Maximum charge range could not be derived from the saved match snapshot.' }
      const maximum = movement + 12 + bonus
      const bonusText = bonus > 0 ? ` + ${bonus} rule bonus` : ''
      return { ...ref, chargeRange: `${maximum}\"`, chargeRangeNote: `Maximum possible charge range: M ${movement} + 12${bonusText}.` }
    }))
    return { ...rule, unitRefs: refs }
  }))
}

function normalizeActions(game: SavedGame, stepId: string, rows: GameTurnRuleV034[]) {
  const casters = casterNames(game)
  return rows.map((row) => {
    const normalized: GameTurnRuleV034 = { ...row }
    if (stepId === 'required-charges' && /^multiple units$/i.test(normalized.source)) normalized.source = 'Required Charge Test'
    if (casters.has(String(normalized.source || '').toLowerCase()) && /\bType:\s*(?:Assailment|Magic Missile|Magical Vortex|Enchantment|Hex|Conveyance)\b/i.test(normalized.summary || '')) normalized.action = 'spell'
    if (stepId === 'required-charges' && /\b(?:impetuous|required charge test|required charge)\b/i.test(`${normalized.label} ${normalized.summary}`)) normalized.action = 'required-charge-test'
    return normalized
  })
}

function dedupe(rows: GameTurnRuleV034[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const refs = (row.unitRefs || []).map((ref) => ref.instanceId).sort().join(',')
    const sourceKey = row.action === 'spell' || !refs ? row.source : ''
    const key = `${row.side}|${sourceKey}|${row.label}|${row.path || ''}|${refs}|${row.summary || ''}|${row.action || 'rule'}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function loadTurnStepGuidanceV034(game: SavedGame, stepId: string, viewSide: 'player' | 'opponent'): Promise<GameTurnRuleV034[]> {
  const [base, rosterSupplement, scenarioSupplement, battlefieldSupplement] = await Promise.all([
    loadBaseTurnStepGuidance(game, stepId, viewSide),
    supplementalRosterRules(game, stepId, viewSide),
    supplementalScenarioRules(game, stepId),
    supplementalBattlefieldRules(game, stepId),
  ])

  const baseRows = (base as GameTurnRuleV034[]).filter((row) => routeBaseRule(row, stepId))
  let rows = normalizeActions(game, stepId, dedupe([...baseRows, ...rosterSupplement, ...scenarioSupplement, ...battlefieldSupplement]))
  if (stepId === 'declare-charges' && viewSide === 'player') rows = await enrichDeclareChargeRanges(game, rows)
  return rows
}
