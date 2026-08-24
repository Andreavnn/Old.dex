import { loadLiveUnitProfile } from '../data/liveBuilderUnits'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import {
  analyzeMatchRuleTiming,
  isFormationRuleName,
  type MatchActionStep,
  type MatchRuleIntent,
  type MatchTurnAffinity,
} from '../domain/matchTiming'
import { extractMechanicalRuleText } from './ruleText'
import { fetchRuleDocument } from './ruleContent'
import { getSavedArmyList } from './savedLists'
import { loadMagicChoices, randomHappeningOptions } from './gameSetup'
import type { GameMagicChoice, GameSide, SavedGame } from './games'

export type MatchRuleSide = 'player' | 'opponent' | 'battle'
export type MatchRuleSourceKind = 'unit' | 'magic-item' | 'scenario' | 'battlefield' | 'army-composition' | 'battle-composition' | 'spell' | 'core'

export type MatchUnitRef = {
  instanceId: string
  name: string
  chargeRange?: string
  chargeRangeNote?: string
}

export type MatchGuidanceRule = {
  id: string
  side: MatchRuleSide
  sourceKind: MatchRuleSourceKind
  source: string
  label: string
  path?: string
  summary: string
  unitRefs?: MatchUnitRef[]
  action?: 'rule' | 'declare-charge' | 'spell' | 'required-charge-test'
  intent?: MatchRuleIntent
  timingConfidence?: number
  turn?: MatchTurnAffinity
  requiredCharge?: boolean
  relatedRules?: Array<{ source: string; label: string; path?: string; summary: string }>
}

export type MatchDeploymentRule = {
  label: string
  path: string
  summary: string
}

export type MatchDeploymentGuidance = {
  instanceId: string
  formations: Array<{ label: string; path: string }>
  deploymentRules: MatchDeploymentRule[]
  canReserve: boolean
  reserveReason?: string
}

export type MatchStartRoundRule = {
  side: MatchRuleSide
  source: string
  label: string
  path?: string
  summary: string
}

type CompiledRuleEvent = MatchGuidanceRule & {
  step: MatchActionStep
  turn: MatchTurnAffinity
}

type CompiledKnowledge = {
  signature: string
  playerEvents: CompiledRuleEvent[]
  opponentEvents: CompiledRuleEvent[]
  battleEvents: CompiledRuleEvent[]
}

const ruleTextCache = new Map<string, Promise<string>>()
const knowledgeCache = new Map<string, Promise<CompiledKnowledge>>()
const compositionRulePaths: Record<string, string> = {
  'battle-march': '/warhammer-armies/battle-march',
  'open-war': '/matched-play/open-war',
  'grand-melee': '/matched-play/grand-melee',
  'combined-arms': '/matched-play/combined-arms',
}

function compact(value: string) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function stableRuleId(parts: Array<string | number | undefined>) {
  return parts.map((part) => compact(String(part ?? '')).toLowerCase()).join('|')
}

function cleanRuleText(value: string) {
  let text = compact(value)
  if (!text) return ''
  text = text
    .replace(/\bURL Copied!\b/gi, ' ')
    .replace(/\bCross-Reference Links\b/gi, ' ')
    .replace(/\bTable of Contents\b/gi, ' ')
    .replace(/\bLast update:\s*\d{4}\s+[A-Za-z]+\s+\d{1,2}\b/gi, ' ')
    .replace(/\b(?:Rulebook|Ravening Hordes|Forces of Fantasy|Arcane Journal(?:\s*[-–—:]?\s*[^,.]+)?),?\s*p\.\s*\d+\b/gi, ' ')
    .replace(/^(?:\d{1,3}\s+)(?=[A-Z])/g, '')
  const seen = new Set<string>()
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(compact).filter(Boolean) || []
  return sentences.filter((row) => {
    if (/^(?:Previous|Next|Source:|Contents|Home|Search)\b/i.test(row)) return false
    if (/^(?:Last update|Rulebook|Ravening Hordes|Forces of Fantasy)\b/i.test(row)) return false
    const key = row.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).join(' ').trim()
}

function normalizedHeading(value: string) {
  return compact(value).toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function labelledSectionText(dom: Document, label: string) {
  const wanted = normalizedHeading(label)
  if (!wanted) return ''
  const headings = Array.from(dom.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'))
  const heading = headings.find((node) => {
    const value = normalizedHeading(node.textContent || '')
    return value === wanted || (wanted.length >= 6 && (value.startsWith(`${wanted} `) || wanted.startsWith(`${value} `)))
  })
  if (!heading) return ''
  const level = Number(heading.tagName.slice(1))
  const rows: string[] = []
  let cursor: Element | null = heading.nextElementSibling
  while (cursor) {
    if (/^H[1-6]$/.test(cursor.tagName) && Number(cursor.tagName.slice(1)) <= level) break
    if (!cursor.matches('nav,header,footer,aside,script,style')) {
      const value = cleanRuleText(cursor.textContent || '')
      if (value && value.length >= 8) rows.push(value)
    }
    cursor = cursor.nextElementSibling
  }
  return cleanRuleText(rows.join(' '))
}

function mechanicalPageText(html: string, label = '') {
  const extracted = cleanRuleText(extractMechanicalRuleText(html) || '')
  if (typeof DOMParser === 'undefined') return extracted
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  dom.querySelectorAll('script,style,nav,header,footer,aside').forEach((node) => node.remove())

  // Prefer the section whose heading actually names the roster rule/item. This
  // prevents a page-level extractor from returning a nearby rule such as Warband
  // when the roster entry is Mob Rule.
  const labelled = labelledSectionText(dom, label)
  if (labelled) return labelled

  let rows = Array.from(dom.querySelectorAll<HTMLElement>('p,li,blockquote,dd'))
    .map((node) => compact(node.textContent || ''))
  if (!rows.length) rows = Array.from(dom.querySelectorAll<HTMLElement>('td')).map((node) => compact(node.textContent || ''))
  rows = rows
    .filter((row) => row.length >= 8 && row.length <= 5000)
    .filter((row) => !/^(?:URL Copied!|Cross-Reference Links|Previous\b|Next\b|Source:|Table of Contents|Last update:)/i.test(row))
    .filter((row) => !(row.length > 180 && /\bTable of Contents\b/i.test(row) && /\bLast update:/i.test(row)))
    .map(cleanRuleText)
    .filter(Boolean)
  const seen = new Set<string>()
  const candidates = [extracted, ...rows].filter(Boolean).filter((row) => {
    const key = row.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return cleanRuleText(candidates.join(' '))
}

function ruleText(path: string, fallback: string) {
  if (!path) return Promise.resolve(compact(fallback))
  const cached = ruleTextCache.get(path)
  if (cached) return cached
  const pending = (async () => {
    try {
      const document = await fetchRuleDocument(path)
      return mechanicalPageText(document.html, fallback) || compact(fallback)
    } catch {
      return compact(fallback)
    }
  })()
  ruleTextCache.set(path, pending)
  return pending
}

function compositionSectionText(path: string, headingLabel: string) {
  const cacheKey = `${path}#section:${headingLabel.toLowerCase()}`
  const cached = ruleTextCache.get(cacheKey)
  if (cached) return cached
  const pending = (async () => {
    if (!path || !headingLabel || typeof DOMParser === 'undefined') return ''
    try {
      const document = await fetchRuleDocument(path)
      const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
      const wanted = compact(headingLabel).toLowerCase()
      const headings = Array.from(dom.querySelectorAll<HTMLElement>('h2,h3,h4,h5,h6'))
      const heading = headings.find((node) => compact(node.textContent || '').toLowerCase() === wanted)
      if (!heading) return ''
      const level = Number(heading.tagName.slice(1))
      const rows: string[] = []
      let cursor: Element | null = heading.nextElementSibling
      while (cursor) {
        if (/^H[1-6]$/.test(cursor.tagName) && Number(cursor.tagName.slice(1)) <= level) break
        const value = compact(cursor.textContent || '')
        if (value) rows.push(value)
        cursor = cursor.nextElementSibling
      }
      return rows.join(' ')
    } catch {
      return ''
    }
  })()
  ruleTextCache.set(cacheKey, pending)
  return pending
}

function gameRoster(game: SavedGame, side: 'player' | 'opponent') {
  if (side === 'player') return game.playerRoster?.length ? game.playerRoster : (getSavedArmyList(game.playerListId)?.roster || [])
  return game.opponentRoster?.length ? game.opponentRoster : (game.opponentListId ? getSavedArmyList(game.opponentListId)?.roster || [] : [])
}

function ruleEventRows(input: {
  side: MatchRuleSide
  sourceKind: MatchRuleSourceKind
  source: string
  label: string
  path?: string
  text: string
  unitRefs?: MatchUnitRef[]
}) {
  const fullRuleText = cleanRuleText(input.text)
  return analyzeMatchRuleTiming(input.label, fullRuleText).map((timing) => ({
    id: stableRuleId([input.side, input.sourceKind, input.label, input.path, timing.step, timing.intent, input.unitRefs?.map((row) => row.instanceId).join(',')]),
    side: input.side,
    sourceKind: input.sourceKind,
    source: input.source,
    label: input.label,
    path: input.path,
    // Timing analysis decides WHERE a rule belongs; the card should still show
    // the complete cleaned mechanical rule rather than one matching sentence.
    summary: fullRuleText || cleanRuleText(timing.text),
    unitRefs: input.unitRefs ? [...input.unitRefs] : undefined,
    action: timing.intent === 'required-charge-test' ? 'required-charge-test' as const : 'rule' as const,
    intent: timing.intent,
    timingConfidence: timing.confidence,
    turn: timing.turn,
    step: timing.step,
  }))
}

async function compileRosterEvents(roster: BuilderRosterSelection[], side: 'player' | 'opponent') {
  const output: CompiledRuleEvent[] = []
  const jobs: Array<Promise<void>> = []
  for (const unit of roster) {
    const unitRef = [{ instanceId: unit.instanceId, name: unit.name }]
    for (const rule of unit.specialRules || []) {
      jobs.push((async () => {
        const text = await ruleText(rule.path, rule.label)
        output.push(...ruleEventRows({ side, sourceKind: 'unit', source: unit.name, label: rule.label, path: rule.path, text, unitRefs: unitRef }))
      })())
    }
    for (const item of unit.magicItems || []) {
      if (!item.slug) continue
      const path = `/magic-item/${item.slug}`
      jobs.push((async () => {
        const text = await ruleText(path, item.name)
        output.push(...ruleEventRows({ side, sourceKind: 'magic-item', source: unit.name, label: item.name, path, text, unitRefs: unitRef }))
      })())
    }
  }
  await Promise.allSettled(jobs)
  return output
}

function spellStep(choice: GameMagicChoice): MatchActionStep | '' {
  const type = compact(choice.type || '').toLowerCase()
  if (type === 'enchantment' || type === 'hex') return 'conjuration'
  if (type === 'conveyance') return 'remaining-moves'
  if (type === 'magic missile' || type === 'magical vortex') return 'special-shooting'
  if (type === 'assailment') return 'fight'
  const event = analyzeMatchRuleTiming(choice.name, choice.summary || '').find((row) => ['command','conjuration','remaining-moves','special-shooting','shooting','fight'].includes(row.step))
  return event?.step || ''
}

async function compileSpellEvents(game: SavedGame) {
  const output: CompiledRuleEvent[] = []
  for (const savedCaster of game.magicSetup || []) {
    const caster = { ...savedCaster, availableLores: [...(savedCaster.availableLores || [])], selectedSpellIds: [...(savedCaster.selectedSpellIds || [])], choices: savedCaster.choices?.map((choice) => ({ ...choice })) }
    const choices = caster.choices?.length ? caster.choices : await loadMagicChoices(caster)
    const selected = new Set(caster.selectedSpellIds || [])
    const relevant = caster.kind === 'Wizard' ? choices.filter((choice) => selected.has(choice.id)) : choices
    for (const choice of relevant) {
      const step = spellStep(choice)
      if (!step) continue
      const details = [choice.type ? `Type: ${choice.type}.` : '', choice.castingValue ? `Casting Value: ${choice.castingValue}.` : '', choice.range ? `Range: ${choice.range}.` : '', choice.summary || ''].filter(Boolean).join(' ')
      output.push({
        id: stableRuleId(['player', 'spell', caster.instanceId, choice.id, step]),
        side: 'player', sourceKind: 'spell', source: caster.name, label: choice.name, path: choice.path,
        summary: details || `${choice.name} may be attempted by ${caster.name}.`,
        action: 'spell', intent: 'spell', timingConfidence: 120, turn: 'own', step,
        unitRefs: [{ instanceId: caster.instanceId, name: caster.name }],
      })
    }
  }
  return output
}

async function compileScenarioEvents(game: SavedGame) {
  const guidance = game.scenarioGuidance
  if (!guidance?.scenarioRules?.length) return [] as CompiledRuleEvent[]
  return guidance.scenarioRules.flatMap((text, index) => ruleEventRows({
    side: 'battle', sourceKind: 'scenario', source: game.scenario,
    label: guidance.scenarioRules.length > 1 ? `Scenario Rule ${index + 1}` : 'Scenario Rule',
    path: guidance.sourcePath, text,
  }))
}

async function compileBattlefieldEvents(game: SavedGame) {
  const selected = new Set(game.battlefieldConditions || [])
  const output: CompiledRuleEvent[] = []
  await Promise.allSettled(randomHappeningOptions.filter((row) => selected.has(row.id)).map(async (row) => {
    const text = await ruleText(row.path, row.label)
    output.push(...ruleEventRows({ side: 'battle', sourceKind: 'battlefield', source: 'Battlefield', label: row.label, path: row.path, text }))
  }))
  return output
}

async function compileCompositionEvents(game: SavedGame) {
  const output: CompiledRuleEvent[] = []
  const playerList = getSavedArmyList(game.playerListId)
  const opponentList = game.opponentListId ? getSavedArmyList(game.opponentListId) : null
  const sides = [
    { side: 'player' as const, armyId: game.playerArmyId || playerList?.army || '', compositionName: game.playerCompositionName || playerList?.compositionName || '', battleRule: game.playerCompositionRule || playerList?.rule || '' },
    { side: 'opponent' as const, armyId: game.opponentArmyId || opponentList?.army || '', compositionName: game.opponentCompositionName || opponentList?.compositionName || '', battleRule: game.opponentCompositionRule || opponentList?.rule || '' },
  ]
  await Promise.allSettled(sides.map(async (entry) => {
    if (entry.armyId && entry.compositionName) {
      const path = `/army/${entry.armyId}`
      const text = await compositionSectionText(path, entry.compositionName)
      if (text) output.push(...ruleEventRows({ side: entry.side, sourceKind: 'army-composition', source: entry.compositionName, label: 'Army Composition', path, text }))
    }
    const path = compositionRulePaths[String(entry.battleRule || '')]
    if (path) {
      const text = await ruleText(path, String(entry.battleRule || 'Battle Composition'))
      output.push(...ruleEventRows({ side: 'battle', sourceKind: 'battle-composition', source: entry.side === 'player' ? 'Friendly battle composition' : 'Enemy battle composition', label: String(entry.battleRule), path, text }))
    }
  }))
  return output
}

function fingerprint(game: SavedGame) {
  const rosterBits = (side: 'player' | 'opponent') => gameRoster(game, side).map((row) => ({
    i: row.instanceId,
    u: row.unitId,
    r: (row.specialRules || []).map((rule) => `${rule.label}|${rule.path}`).sort(),
    m: (row.magicItems || []).map((item) => `${item.name}|${item.slug}|${item.count}`).sort(),
    mv: row.movement,
    e: [...(row.equipmentIds || [])].sort(),
  }))
  return JSON.stringify({
    id: game.id,
    p: rosterBits('player'), o: rosterBits('opponent'),
    s: game.scenarioGuidance?.scenarioRules || [], sp: game.scenarioGuidance?.sourcePath || '',
    b: [...(game.battlefieldConditions || [])].sort(),
    pc: [game.playerArmyId, game.playerCompositionName, game.playerCompositionRule],
    oc: [game.opponentArmyId, game.opponentCompositionName, game.opponentCompositionRule],
    magic: (game.magicSetup || []).map((caster) => ({ id: caster.instanceId, lore: caster.selectedLore, selected: [...(caster.selectedSpellIds || [])].sort(), choices: (caster.choices || []).map((choice) => `${choice.id}|${choice.type || ''}|${choice.summary || ''}`) })),
  })
}

function groupCompiledEvents(rows: CompiledRuleEvent[]) {
  const grouped = new Map<string, CompiledRuleEvent>()
  for (const row of rows) {
    // Canonical rule identity, not a truncated sentence, controls deduplication.
    // This prevents a joined Character and its host unit from producing two cards
    // for the same Individual rule while still retaining every affected model.
    const key = stableRuleId([row.side, row.sourceKind, row.label, row.path, row.step, row.intent])
    const prior = grouped.get(key)
    if (!prior) { grouped.set(key, { ...row, unitRefs: row.unitRefs ? [...row.unitRefs] : undefined }); continue }
    if ((row.summary || '').length > (prior.summary || '').length) prior.summary = row.summary
    const refs = new Map((prior.unitRefs || []).map((ref) => [ref.instanceId, ref]))
    for (const ref of row.unitRefs || []) refs.set(ref.instanceId, ref)
    prior.unitRefs = refs.size ? [...refs.values()] : undefined
    if (prior.unitRefs && prior.unitRefs.length > 1 && (prior.sourceKind === 'unit' || prior.sourceKind === 'magic-item')) prior.source = 'Affected units'
  }
  return [...grouped.values()].sort((a, b) => {
    const kindPriority: Record<MatchRuleSourceKind, number> = { scenario: 0, battlefield: 1, 'battle-composition': 2, 'army-composition': 3, spell: 4, 'magic-item': 5, unit: 6, core: 7 }
    return (kindPriority[a.sourceKind] ?? 9) - (kindPriority[b.sourceKind] ?? 9) || b.timingConfidence! - a.timingConfidence! || a.label.localeCompare(b.label)
  })
}

async function compileKnowledge(game: SavedGame): Promise<CompiledKnowledge> {
  const signature = fingerprint(game)
  const key = `${game.id}:${signature}`
  const cached = knowledgeCache.get(key)
  if (cached) return cached
  const pending = (async () => {
    const [player, opponent, spells, scenario, battlefield, composition] = await Promise.all([
      compileRosterEvents(gameRoster(game, 'player'), 'player'),
      compileRosterEvents(gameRoster(game, 'opponent'), 'opponent'),
      compileSpellEvents(game),
      compileScenarioEvents(game),
      compileBattlefieldEvents(game),
      compileCompositionEvents(game),
    ])
    return {
      signature,
      playerEvents: groupCompiledEvents([...player, ...spells, ...composition.filter((row) => row.side === 'player')]),
      opponentEvents: groupCompiledEvents([...opponent, ...composition.filter((row) => row.side === 'opponent')]),
      battleEvents: groupCompiledEvents([...scenario, ...battlefield, ...composition.filter((row) => row.side === 'battle')]),
    }
  })()
  knowledgeCache.set(key, pending)
  // Keep only the newest few compiled snapshots for long-running installed apps.
  if (knowledgeCache.size > 8) {
    const first = knowledgeCache.keys().next().value
    if (first && first !== key) knowledgeCache.delete(first)
  }
  return pending
}

function stepDefaultsToOwnTurn(step: MatchActionStep) {
  return ['start-of-turn','command','conjuration','rally','required-charges','declare-charges','charge-moves','compulsory-moves','remaining-moves','special-shooting','shooting'].includes(step)
}

function visibleForTurn(row: CompiledRuleEvent, viewSide: GameSide) {
  if (row.side === 'battle') return row.turn !== (viewSide === 'player' ? 'enemy' : 'own')
  if (row.side !== 'player' && row.side !== 'opponent') return false

  // Timing words such as "your turn" and "enemy turn" are interpreted from
  // the owner of the rule, not from the person holding the device. This lets an
  // imported enemy roster contribute its own actions on Enemy's Turn while the
  // friendly roster still contributes reactions and opponent-turn triggers.
  const ownerIsActive = row.side === viewSide
  if (ownerIsActive) return row.turn !== 'enemy'
  if (row.turn === 'enemy') return true
  if (row.intent === 'reaction') return true
  if (!stepDefaultsToOwnTurn(row.step) && row.turn === 'either') return true
  return false
}

function chargeTestKey(game: SavedGame, side: 'player' | 'opponent', instanceId: string) {
  return `${game.round}:${side}:required-charges:${instanceId}`
}


function numericMovement(row: BuilderRosterSelection) {
  const value = Number(row.movement || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function gameArmySlug(game: SavedGame) { return game.playerArmyId || getSavedArmyList(game.playerListId)?.army || '' }
function gameCompositionId(game: SavedGame) { return getSavedArmyList(game.playerListId)?.composition || '' }

async function fallbackMovement(game: SavedGame, row: BuilderRosterSelection) {
  const stored = numericMovement(row)
  if (stored) return stored
  const armySlug = gameArmySlug(game)
  if (!armySlug) return 0
  try {
    const unit = await loadLiveUnitProfile(armySlug, game.playerArmyName, row.unitId, gameCompositionId(game))
    if (!unit) return 0
    const selectedIds = new Set(row.equipmentIds || [])
    const optionalProfiles = (unit.optionalProfiles || []) as Array<{ selectionId: string; profile: Record<string, string> }>
    const selectedOptional = optionalProfiles.filter((profile) => selectedIds.has(profile.selectionId))
    const optionalValues = selectedOptional.map((profile) => Number.parseInt(profile.profile.M || '', 10)).filter((value: number) => Number.isFinite(value) && value > 0)
    if (optionalValues.length) return Math.max(...optionalValues)
    const baseRows = (unit.profiles?.length ? unit.profiles : [{ name: unit.name, profile: unit.profile }]) as Array<{ name: string; profile: Record<string, string> }>
    const values = baseRows.map((profile) => Number.parseInt(profile.profile.M || '', 10)).filter((value: number) => Number.isFinite(value) && value > 0)
    return Math.max(0, ...values)
  } catch {
    return 0
  }
}

async function maximumChargeRangeBonus(row: BuilderRosterSelection) {
  let bonus = (row.specialRules || []).some((rule) => /^Swiftstride(?:\s|\(|$)/i.test(rule.label)) ? 3 : 0
  const seen = new Set<string>()
  const sources = [
    ...(row.specialRules || []).filter((rule) => !/^Swiftstride(?:\s|\(|$)/i.test(rule.label)).map((rule) => ({ path: rule.path, fallback: rule.label })),
    ...(row.magicItems || []).filter((item) => item.slug).map((item) => ({ path: `/magic-item/${item.slug}`, fallback: item.name })),
  ]
  for (const source of sources) {
    if (!source.path || seen.has(source.path)) continue
    seen.add(source.path)
    const text = await ruleText(source.path, source.fallback)
    const values = [...text.matchAll(/(?:increases?|increase|increased)\s+(?:its|the unit'?s)?\s*maximum possible charge range\s+by\s+(\d+)\s*["”']?/gi)].map((match) => Number(match[1]) || 0)
    if (values.length) bonus += Math.max(...values)
  }
  return bonus
}

async function declareChargeRows(game: SavedGame, relatedEvents: CompiledRuleEvent[] = []): Promise<MatchGuidanceRule[]> {
  const rows = gameRoster(game, 'player')
  return Promise.all(rows.map(async (unit) => {
    const result = game.chargeTests?.[chargeTestKey(game, 'player', unit.instanceId)]
    const required = result === 'fail'
    const movement = await fallbackMovement(game, unit)
    const bonus = await maximumChargeRangeBonus(unit)
    const maximum = movement > 0 ? movement + 6 + bonus : 0
    const bonusText = bonus > 0 ? ` + ${bonus} rule bonus` : ''
    const ref: MatchUnitRef = {
      instanceId: unit.instanceId,
      name: unit.name,
      chargeRange: maximum ? `${maximum}\"` : 'See Movement profile',
      chargeRangeNote: maximum ? `Maximum declaration range: M ${movement} + 6${bonusText}.` : 'Maximum declaration range could not be derived from the saved match snapshot.',
    }
    const seen = new Set<string>()
    const relatedRules = relatedEvents
      .filter((event) => event.unitRefs?.some((unitRef) => unitRef.instanceId === unit.instanceId))
      .map((event) => ({ source: event.source, label: event.label, path: event.path, summary: event.summary }))
      .filter((event) => { const key = `${event.label}|${event.path || ''}|${event.summary}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
    return {
      id: stableRuleId(['declare-charge', game.round, unit.instanceId]),
      side: 'player', sourceKind: 'core', source: unit.name, label: 'Declare & Resolve Charge',
      summary: required ? 'Failed Required Charge Test — this unit must declare a charge if a legal target is available, then immediately roll and resolve that charge.' : 'If this unit charges, declare the target, roll and resolve the charge before declaring another charge.',
      unitRefs: [ref], action: 'declare-charge', requiredCharge: required, relatedRules,
    } satisfies MatchGuidanceRule
  }))
}

function coreEnemyGuidance(step: MatchActionStep, viewSide: GameSide): MatchGuidanceRule[] {
  if (viewSide !== 'opponent') return []
  if (step === 'declare-charges') return [{
    id: 'core|enemy-charge-reactions', side: 'player', sourceKind: 'core', source: 'Core Rules', label: 'Charge Reactions',
    path: '/the-movement-phase/charge-reactions', summary: 'When an enemy charge is declared against a friendly unit, choose and resolve its legal charge reaction and any reaction-specific special rules.', action: 'rule', intent: 'reaction',
  }]
  if (['conjuration','remaining-moves','special-shooting'].includes(step)) return [
    { id: `core|${step}|wizardly-dispel`, side: 'player', sourceKind: 'core', source: 'Core Rules', label: 'Wizardly Dispel', path: '/magic/dispelling-enemy-spells', summary: 'When the enemy casts an eligible spell, check whether a friendly Wizard can make a Wizardly Dispel attempt.', action: 'rule', intent: 'reaction' },
    { id: `core|${step}|fated-dispel`, side: 'player', sourceKind: 'core', source: 'Core Rules', label: 'Fated Dispel', path: '/magic/dispelling-enemy-spells', summary: 'A Fated Dispel may be used when the core magic rules permit it. Track its use separately from Wizardly Dispel attempts.', action: 'rule', intent: 'reaction' },
  ]
  return []
}

function toGuidance(rows: CompiledRuleEvent[]) {
  return rows.map(({ step: _step, turn: _turn, ...row }) => ({ ...row }))
}

export async function loadMatchTurnGuidance(game: SavedGame, stepId: string, viewSide: GameSide): Promise<MatchGuidanceRule[]> {
  const step = stepId as MatchActionStep
  const knowledge = await compileKnowledge(game)

  // Old.dex combines declaration and movement into the real table sequence: a
  // charge is declared, rolled and resolved before the next charge is declared.
  // Unit-specific rules from either source-book operation are attached directly
  // to that unit's charge entry instead of becoming a second page of cards.
  if (step === 'declare-charges' && viewSide === 'player') {
    const playerChargeEvents = knowledge.playerEvents.filter((row) => ['declare-charges', 'charge-moves'].includes(row.step) && visibleForTurn(row, viewSide))
    const battleChargeEvents = knowledge.battleEvents.filter((row) => ['declare-charges', 'charge-moves'].includes(row.step) && visibleForTurn(row, viewSide))
    const rows = [...toGuidance(battleChargeEvents), ...(await declareChargeRows(game, playerChargeEvents))]
    const seen = new Set<string>()
    return rows.filter((row) => { const key = row.id || stableRuleId([row.side,row.source,row.label,row.path,row.summary]); if (seen.has(key)) return false; seen.add(key); return true })
  }

  // Break Tests and Follow Up/Pursuit are likewise resolved combat-by-combat.
  // The UI presents them together while the compiler keeps the source timing
  // distinct enough to understand each rule correctly.
  const acceptedSteps: MatchActionStep[] = step === 'break-test' ? ['break-test', 'follow-up'] : [step]
  const sourceRows = [...knowledge.battleEvents, ...knowledge.playerEvents, ...knowledge.opponentEvents]
    .filter((row) => acceptedSteps.includes(row.step) && visibleForTurn(row, viewSide))
  const rows = [...toGuidance(sourceRows), ...coreEnemyGuidance(step, viewSide)]
  const seen = new Set<string>()
  return rows.filter((row) => { const key = row.id || stableRuleId([row.side,row.source,row.label,row.path,row.summary]); if (seen.has(key)) return false; seen.add(key); return true })
}

export async function loadMatchStartRoundGuidance(game: SavedGame): Promise<MatchStartRoundRule[]> {
  const knowledge = await compileKnowledge(game)
  const rows = [...knowledge.battleEvents, ...knowledge.playerEvents, ...knowledge.opponentEvents].filter((row) => row.step === 'round-start')
  return rows.map((row) => ({ side: row.side, source: row.source, label: row.label, path: row.path, summary: row.summary }))
}

export async function loadMatchDeploymentGuidance(game: SavedGame): Promise<MatchDeploymentGuidance[]> {
  const knowledge = await compileKnowledge(game)
  const roster = gameRoster(game, 'player')
  const deploymentEvents = knowledge.playerEvents.filter((row) => row.step === 'deploy-armies')
  const scenarioReserve = /\b(?:held|placed|kept|start(?:s|ing)?) (?:the battle )?in reserve\b|\bAmbushers?\b/i.test(`${game.scenarioGuidance?.setupText || ''} ${game.scenarioGuidance?.deploymentText || ''} ${(game.scenarioGuidance?.scenarioRules || []).join(' ')}`)
  return roster.map((unit) => {
    const rules = deploymentEvents.filter((event) => event.unitRefs?.some((ref) => ref.instanceId === unit.instanceId))
    const reserveRule = rules.find((rule) => rule.intent === 'reserve' || /\b(?:held|placed|kept|start(?:s|ing)?) (?:the battle )?in reserve\b|\bAmbushers?\b/i.test(`${rule.label} ${rule.summary}`))
    return {
      instanceId: unit.instanceId,
      formations: (unit.specialRules || []).filter((rule) => isFormationRuleName(rule.label)).map((rule) => ({ label: rule.label, path: rule.path })),
      deploymentRules: rules.map((rule) => ({ label: rule.label, path: rule.path || '', summary: rule.summary })),
      canReserve: Boolean(reserveRule || scenarioReserve),
      reserveReason: reserveRule?.label || (scenarioReserve ? game.scenario : undefined),
    }
  })
}

export async function requiredChargeTestUnitIds(game: SavedGame) {
  const knowledge = await compileKnowledge(game)
  return new Set(knowledge.playerEvents
    .filter((row) => row.step === 'required-charges' && row.action === 'required-charge-test')
    .flatMap((row) => row.unitRefs || [])
    .map((row) => row.instanceId))
}

export function clearMatchIntelligenceCaches() {
  ruleTextCache.clear()
  knowledgeCache.clear()
}
