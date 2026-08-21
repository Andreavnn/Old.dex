import type { BuilderRosterSelection } from '../domain/rosterTypes'
import type { RawBuilderItem, RawBuilderUnit } from '../domain/rawArmyData'
import { loadArmyData } from './armyData'
import { fetchRuleDocument } from './ruleContent'
import { getSavedArmyList } from './savedLists'
import type { GameMagicCaster, GameMagicChoice, GameScenarioGuidance, SavedGame } from './games'
import { reportAppError } from './appErrors'
import { extractMechanicalRuleText } from './ruleText'

function sourceName(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const row = value as Record<string, unknown>
  return String(row.name_en || row.name || row.text_en || row.text || '').trim()
}

function formatLoreName(value: string) {
  return String(value || '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && ['of', 'the', 'and'].includes(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function slug(value: string) {
  return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.map((value) => value.trim()).filter(Boolean).filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function rowText(row: BuilderRosterSelection) {
  return [
    row.name,
    ...(row.options || []),
    ...(row.includedEquipment || []),
    ...(row.optionalSelections || []),
    ...(row.specialRules || []).map((rule) => rule.label),
    ...(row.loreSelections || []),
  ].join(' ')
}

function wizardLevel(row: BuilderRosterSelection) {
  const matches = [...rowText(row).matchAll(/(?:Level\s*(\d+)\s*Wizard|Wizard\s*Level\s*(\d+))/gi)]
  return matches.reduce((highest, match) => Math.max(highest, Number(match[1] || match[2] || 0)), 0)
}

function prayerLoresFromRow(row: BuilderRosterSelection) {
  const names = [
    ...(row.options || []),
    ...(row.specialRules || []).map((rule) => rule.label),
    ...(row.loreSelections || []),
  ].filter((value) => /^(?:Prayers? of|Prayer of)\b/i.test(String(value || '').trim()))
  return unique(names.map((value) => formatLoreName(String(value))))
}

function optionLores(items: RawBuilderItem[] | undefined, output: string[]) {
  for (const item of items || []) {
    const name = sourceName(item)
    if (/^(?:The\s+)?Lore\s+of\b/i.test(name) || /^(?:Battle Magic|Daemonology|Dark Magic|Elementalism|High Magic|Illusion|Necromancy|Waaagh! Magic)$/i.test(name)) output.push(formatLoreName(name.replace(/^The\s+/i, '')))
    if (Array.isArray(item.options)) optionLores(item.options, output)
  }
}

function rawLores(raw: RawBuilderUnit | null, row: BuilderRosterSelection) {
  const values: string[] = []
  if (raw) {
    for (const source of [raw.lores, raw.magicLores, raw.prayerLores, raw.prayersLores]) {
      if (Array.isArray(source)) source.forEach((value) => { const name = sourceName(value); if (name) values.push(formatLoreName(name)) })
    }
    optionLores(Array.isArray(raw.options) ? raw.options : [], values)
    optionLores(Array.isArray(raw.command) ? raw.command : [], values)
  }
  values.push(...prayerLoresFromRow(row))
  values.push(...(row.loreSelections || []).map(formatLoreName))
  return unique(values)
}

function armyRosterForGame(game: SavedGame) {
  if (game.playerRoster?.length) return game.playerRoster
  return getSavedArmyList(game.playerListId)?.roster || []
}

function armyDataKeyForGame(game: SavedGame) {
  return game.playerArmyId || getSavedArmyList(game.playerListId)?.army || ''
}

function rawUnitMap(data: Record<string, unknown>) {
  const map = new Map<string, RawBuilderUnit>()
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue
    for (const raw of value as RawBuilderUnit[]) if (raw?.id) map.set(String(raw.id), raw)
  }
  return map
}


function rawWizardLevel(raw: RawBuilderUnit | null) {
  if (!raw) return 0
  let highest = 0
  const scan = (items: RawBuilderItem[] | undefined) => {
    for (const item of items || []) {
      const name = sourceName(item)
      const match = name.match(/(?:Level\s*(\d+)\s*Wizard|Wizard\s*Level\s*(\d+))/i)
      if (match && (item.active || item.alwaysActive || item.equippedDefault)) highest = Math.max(highest, Number(match[1] || match[2] || 0))
      if (Array.isArray(item.options)) scan(item.options)
    }
  }
  scan(Array.isArray(raw.options) ? raw.options : [])
  scan(Array.isArray(raw.command) ? raw.command : [])
  const rules = sourceName(raw.specialRules)
  const ruleMatch = rules.match(/(?:Level\s*(\d+)\s*Wizard|Wizard\s*Level\s*(\d+))/i)
  if (ruleMatch) highest = Math.max(highest, Number(ruleMatch[1] || ruleMatch[2] || 0))
  return highest
}

function rawLooksLikePriest(raw: RawBuilderUnit | null) {
  if (!raw) return false
  const values: string[] = []
  for (const source of [raw.prayerLores, raw.prayersLores, raw.prayers]) {
    if (Array.isArray(source)) source.forEach((value) => values.push(sourceName(value)))
  }
  values.push(sourceName(raw.specialRules))
  return values.some((value) => /\b(?:priest|prayers? of|prayer of)\b/i.test(value))
}

function existingCaster(game: SavedGame, instanceId: string) {
  return (game.magicSetup || []).find((entry) => entry.instanceId === instanceId)
}

export async function hydrateFriendlyMagicSetup(game: SavedGame): Promise<GameMagicCaster[]> {
  const roster = armyRosterForGame(game)
  if (!roster.length) return []

  let map = new Map<string, RawBuilderUnit>()
  const dataKey = armyDataKeyForGame(game)
  if (dataKey) {
    try {
      map = rawUnitMap(await loadArmyData(dataKey) as Record<string, unknown>)
    } catch (error) {
      reportAppError(error, 'GAME_SETUP_ARMY_DATA', { gameId: game.id, dataKey })
    }
  }

  const candidates = roster.filter((row) => {
    const raw = map.get(row.unitId) || null
    return wizardLevel(row) > 0 || rawWizardLevel(raw) > 0 || prayerLoresFromRow(row).length > 0 || rawLooksLikePriest(raw) || /\b(?:wizard|priest|prayers?)\b/i.test(rowText(row))
  })
  if (!candidates.length) return []

  return candidates.map((row) => {
    const prior = existingCaster(game, row.instanceId)
    const raw = map.get(row.unitId) || null
    const level = Math.max(wizardLevel(row), rawWizardLevel(raw), Number(prior?.level || 0))
    const prayers = prayerLoresFromRow(row)
    const availableLores = rawLores(raw, row)
    const kind: GameMagicCaster['kind'] = level > 0 ? 'Wizard' : 'Priest'
    const preferred = prior?.selectedLore || row.loreSelections?.[0] || prayers[0] || availableLores[0] || ''
    const selectedLore = availableLores.find((lore) => lore.toLowerCase() === formatLoreName(preferred).toLowerCase()) || formatLoreName(preferred) || availableLores[0] || ''
    return {
      instanceId: row.instanceId,
      unitId: row.unitId,
      name: row.name,
      kind,
      level,
      availableLores,
      selectedLore,
      selectedSpellIds: [...(prior?.selectedSpellIds || [])],
      choices: prior?.selectedLore === selectedLore ? prior.choices?.map((choice) => ({ ...choice })) : undefined,
      sourceLoaded: Boolean(raw),
    }
  })
}

function followingText(heading: Element) {
  const parts: string[] = []
  let cursor: Element | null = heading.nextElementSibling
  while (cursor && !/^H[1-6]$/.test(cursor.tagName)) {
    if (cursor.tagName === 'P') {
      const value = cursor.textContent?.replace(/\s+/g, ' ').trim() || ''
      if (value) parts.push(value)
    }
    cursor = cursor.nextElementSibling
  }
  return parts.slice(-1).join(' ').slice(0, 700)
}

function wizardChoices(dom: Document, lore: string): GameMagicChoice[] {
  const choices: GameMagicChoice[] = []
  const candidates = Array.from(dom.querySelectorAll<HTMLElement>('h2,h3,h4,h5,h6'))
  for (const heading of candidates) {
    const raw = heading.textContent?.replace(/\s+/g, ' ').trim() || ''
    const signature = /\(Signature Spell\)/i.test(raw)
    const numbered = raw.match(/^([1-6])\.\s*(.+)$/)
    if (!signature && !numbered) continue
    const name = (numbered ? numbered[2] : raw.replace(/\s*\(Signature Spell\)\s*/i, '')).trim()
    if (!name) continue
    const id = signature ? `signature-${slug(name)}` : `${numbered?.[1] || choices.length + 1}-${slug(name)}`
    if (choices.some((choice) => choice.id === id)) continue
    choices.push({ id, name, summary: followingText(heading), path: `/the-lores-of-magic/${slug(lore)}`, signature })
  }
  // Some source transports flatten heading markup but preserve linked spell labels.
  if (!choices.length) {
    for (const anchor of Array.from(dom.querySelectorAll<HTMLAnchorElement>('a[href],a[data-rule-path],a[data-app-path]'))) {
      const raw = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
      const signature = /\(Signature Spell\)/i.test(raw)
      const numbered = raw.match(/^([1-6])\.\s*(.+)$/)
      if (!signature && !numbered) continue
      const name = (numbered ? numbered[2] : raw.replace(/\s*\(Signature Spell\)\s*/i, '')).trim()
      const id = signature ? `signature-${slug(name)}` : `${numbered?.[1] || choices.length + 1}-${slug(name)}`
      if (!name || choices.some((choice) => choice.id === id)) continue
      choices.push({ id, name, path: `/the-lores-of-magic/${slug(lore)}`, signature })
    }
  }
  return choices.sort((a, b) => {
    if (a.signature !== b.signature) return a.signature ? -1 : 1
    return a.id.localeCompare(b.id, undefined, { numeric: true })
  })
}

function prayerChoices(dom: Document, lore: string): GameMagicChoice[] {
  const rows: GameMagicChoice[] = []
  for (const item of Array.from(dom.querySelectorAll<HTMLElement>('li'))) {
    const value = item.textContent?.replace(/\s+/g, ' ').trim() || ''
    const match = value.match(/^([^:]{2,80}):\s*(.+)$/)
    if (!match) continue
    const name = match[1].trim()
    if (/^(?:Previous|Next|Cross-Reference)/i.test(name)) continue
    rows.push({ id: `prayer-${slug(name)}`, name, summary: match[2].trim().slice(0, 900), path: `/special-rules/${slug(lore)}` })
  }
  return rows
}

export async function loadMagicChoices(caster: GameMagicCaster): Promise<GameMagicChoice[]> {
  if (!caster.selectedLore) return []
  const prayer = caster.kind === 'Priest' || /^(?:Prayers? of|Prayer of)\b/i.test(caster.selectedLore)
  const path = prayer ? `/special-rules/${slug(caster.selectedLore)}` : `/the-lores-of-magic/${slug(caster.selectedLore)}`
  try {
    const document = await fetchRuleDocument(path)
    const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
    return prayer ? prayerChoices(dom, caster.selectedLore) : wizardChoices(dom, caster.selectedLore)
  } catch (error) {
    reportAppError(error, 'GAME_SETUP_MAGIC_CHOICES', { caster: caster.name, lore: caster.selectedLore, path })
    return []
  }
}

export function magicSelectionLimit(caster: GameMagicCaster) {
  return caster.kind === 'Wizard' ? Math.max(1, caster.level || 1) : 0
}


const scenarioPathOverrides: Record<string, string> = {
  'open-battle': '/warhammer-battles/open-battle',
  'meeting-engagement': '/warhammer-battles/meeting-engagement',
  'flank-attack': '/warhammer-battles/flank-attack',
  'command-and-control': '/warhammer-battles/command-and-control',
  'mountain-pass': '/warhammer-battles/mountain-pass',
  'break-point': '/warhammer-battles/break-point',
}

function sectionBlocks(dom: Document, labels: string[]) {
  const headings = Array.from(dom.querySelectorAll<HTMLElement>('h2,h3,h4,h5,h6'))
  const heading = headings.find((candidate) => labels.some((label) => (candidate.textContent?.replace(/\s+/g, ' ').trim() || '').toLowerCase() === label.toLowerCase()))
  if (!heading) return [] as string[]
  const level = Number(heading.tagName.slice(1))
  const rows: string[] = []
  let cursor: Element | null = heading.nextElementSibling
  while (cursor) {
    if (/^H[1-6]$/.test(cursor.tagName) && Number(cursor.tagName.slice(1)) <= level) break
    const value = cursor.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (value && !rows.includes(value)) rows.push(value)
    cursor = cursor.nextElementSibling
  }
  return rows
}

function parseRoundLimit(value: string) {
  const numeric = value.match(/(?:last|for)\s+(\d+)\s+rounds?/i)
  if (numeric) return Math.max(1, Number(numeric[1]))
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
  const written = value.match(/(?:last|for)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\s+rounds?/i)
  return written ? words[written[1].toLowerCase()] : 6
}

export async function loadScenarioGuidance(scenario: string): Promise<GameScenarioGuidance> {
  const scenarioSlug = slug(scenario)
  const sourcePath = scenarioPathOverrides[scenarioSlug] || `/warhammer-battles/${scenarioSlug}`
  const fallback: GameScenarioGuidance = { sourcePath, roundLimit: 6, gameLength: 'Most battles last for six rounds.', setupText: '', scenarioRules: [], specificTerrain: false }
  try {
    const document = await fetchRuleDocument(sourcePath)
    const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
    const setupRows = sectionBlocks(dom, ['Set-up', 'Setup'])
    const lengthRows = sectionBlocks(dom, ['Game Length'])
    const ruleRows = sectionBlocks(dom, ['Scenario Special Rules'])
    const setupText = setupRows.join(' ').slice(0, 1800)
    const gameLength = lengthRows.join(' ').slice(0, 1300) || fallback.gameLength
    const specificTerrain = Boolean(setupText && !/^Place terrain as described\.?$/i.test(setupText) && /(?:terrain|feature|hill|wood|woods|building|road|river|stream|marsh|ruin|tower|objective|impassable|battlefield|centre|center|zone)/i.test(setupText))
    return {
      sourcePath,
      roundLimit: parseRoundLimit(gameLength),
      gameLength,
      setupText,
      scenarioRules: ruleRows.filter((row) => !/^This scenario has no special rules\.?$/i.test(row)).slice(0, 6),
      specificTerrain,
    }
  } catch (error) {
    reportAppError(error, 'GAME_SCENARIO_GUIDANCE', { scenario, sourcePath })
    return fallback
  }
}

export type GameDeploymentRule = {
  label: string
  path: string
  summary: string
}

export type GameDeploymentGuidance = {
  instanceId: string
  formations: Array<{ label: string; path: string }>
  deploymentRules: GameDeploymentRule[]
  canReserve: boolean
  reserveReason?: string
}

export type GameStartRoundRule = {
  side: 'player' | 'opponent' | 'battle'
  source: string
  label: string
  path?: string
  summary: string
}

const formationNames = new Set(['close order', 'open order', 'skirmishers'])
const deploymentNamePattern = /\b(?:ambushers?|scouts?|vanguard|reserve|reinforcement|deploy|deployment|hidden|tunnel|tunnelling|tunneling|underground|flank|outflank)\b/i
const deploymentTextPattern = /\b(?:deploy|deployment|deployed|set up|setup|before either side deploys|after both sides have deployed|held in reserve|placed in reserve|reserve|reinforcement|scout|vanguard|ambush)\b/i
const reserveTextPattern = /\b(?:held|placed|kept|start(?:s|ing)?)\s+(?:the battle )?in reserve\b|\breserves?\b|\bambushers?\b/i
const startRoundTextPattern = /\b(?:at|during) the (?:very )?(?:start|beginning) of (?:each|every|the|a) round\b|\b(?:start|beginning) of (?:each|every|the|a) round\b/i

function compactText(value: string) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() }
function sentenceRows(value: string) { return compactText(value).match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(compactText).filter(Boolean) || [] }
function pageSentences(html: string, pattern: RegExp) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  dom.querySelectorAll('script,style,nav,header,footer').forEach((node) => node.remove())
  const blocks = Array.from(dom.querySelectorAll<HTMLElement>('p,li,td')).map((node) => compactText(node.textContent || '')).filter(Boolean)
  const source = blocks.length ? blocks : [compactText(dom.body.textContent || '')]
  const seen = new Set<string>()
  return source.flatMap(sentenceRows).filter((row) => pattern.test(row)).filter((row) => {
    const key = row.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function ruleDocumentSummary(path: string, pattern: RegExp) {
  try {
    const document = await fetchRuleDocument(path)
    const phaseRows = pageSentences(document.html, pattern)
    if (phaseRows.length) return phaseRows.slice(0, 3).join(' ')
    return pattern === deploymentTextPattern && deploymentNamePattern.test(path) ? extractMechanicalRuleText(document.html) : ''
  } catch (error) {
    reportAppError(error, 'GAME_PHASE_RULE_GUIDANCE', { path })
    return ''
  }
}

function uniqueRosterRules(roster: BuilderRosterSelection[]) {
  const map = new Map<string, { label: string; path: string }>()
  for (const row of roster) for (const rule of row.specialRules || []) {
    const key = `${String(rule.label || '').toLowerCase()}|${rule.path || ''}`
    if (rule.label && !map.has(key)) map.set(key, { label: rule.label, path: rule.path })
  }
  return [...map.values()]
}

export async function loadFriendlyDeploymentGuidance(game: SavedGame): Promise<GameDeploymentGuidance[]> {
  const roster = armyRosterForGame(game)
  const sourceRules = uniqueRosterRules(roster)
  const summaryByRule = new Map<string, string>()
  await Promise.allSettled(sourceRules.map(async (rule) => {
    if (!rule.path) return
    const summary = await ruleDocumentSummary(rule.path, deploymentTextPattern)
    if (summary) summaryByRule.set(`${rule.label.toLowerCase()}|${rule.path}`, summary)
  }))
  const scenarioReserve = reserveTextPattern.test(`${game.scenarioGuidance?.setupText || ''} ${(game.scenarioGuidance?.scenarioRules || []).join(' ')}`)
  return roster.map((row) => {
    const formations = (row.specialRules || [])
      .filter((rule) => formationNames.has(String(rule.label || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()))
      .map((rule) => ({ label: rule.label, path: rule.path }))
    const deploymentRules: GameDeploymentRule[] = []
    for (const rule of row.specialRules || []) {
      const key = `${String(rule.label || '').toLowerCase()}|${rule.path || ''}`
      const summary = summaryByRule.get(key) || ''
      if (!deploymentNamePattern.test(rule.label) && !summary) continue
      deploymentRules.push({ label: rule.label, path: rule.path, summary })
    }
    const reserveRule = deploymentRules.find((rule) => reserveTextPattern.test(`${rule.label} ${rule.summary}`))
    return {
      instanceId: row.instanceId,
      formations,
      deploymentRules,
      canReserve: Boolean(reserveRule || scenarioReserve),
      reserveReason: reserveRule ? reserveRule.label : scenarioReserve ? game.scenario : undefined,
    }
  })
}

const compositionRulePaths: Record<string, string> = {
  'battle-march': '/warhammer-armies/battle-march',
  'open-war': '/matched-play/open-war',
  'grand-melee': '/matched-play/grand-melee',
  'combined-arms': '/matched-play/combined-arms',
}

function sectionPhaseSentences(html: string, headingLabel: string, pattern: RegExp) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  const wanted = compactText(headingLabel).toLowerCase()
  if (!wanted) return [] as string[]
  const headings = Array.from(dom.querySelectorAll<HTMLElement>('h2,h3,h4,h5,h6'))
  const heading = headings.find((node) => compactText(node.textContent || '').toLowerCase() === wanted)
  if (!heading) return [] as string[]
  const level = Number(heading.tagName.slice(1))
  const blocks: string[] = []
  let cursor: Element | null = heading.nextElementSibling
  while (cursor) {
    if (/^H[1-6]$/.test(cursor.tagName) && Number(cursor.tagName.slice(1)) <= level) break
    const value = compactText(cursor.textContent || '')
    if (value) blocks.push(value)
    cursor = cursor.nextElementSibling
  }
  return blocks.flatMap(sentenceRows).filter((row) => pattern.test(row))
}

async function addArmyCompositionStartRound(output: GameStartRoundRule[], side: 'player' | 'opponent', armyId: string, compositionName: string) {
  if (!armyId || !compositionName) return
  const path = `/army/${armyId}`
  try {
    const document = await fetchRuleDocument(path)
    const summary = sectionPhaseSentences(document.html, compositionName, startRoundTextPattern).slice(0, 3).join(' ')
    if (!summary) return
    output.push({ side, source: `${compositionName} Army Composition`, label: 'Army Composition', path, summary })
  } catch (error) {
    reportAppError(error, 'GAME_ARMY_COMPOSITION_PHASE_GUIDANCE', { side, armyId, compositionName })
  }
}

async function addStartRoundReference(output: GameStartRoundRule[], row: { side: GameStartRoundRule['side']; source: string; label: string; path?: string; text?: string }) {
  let summary = sentenceRows(row.text || '').filter((sentence) => startRoundTextPattern.test(sentence)).join(' ')
  if (!summary && row.path) summary = await ruleDocumentSummary(row.path, startRoundTextPattern)
  if (!summary) return
  const key = `${row.side}|${row.source}|${row.label}|${summary}`.toLowerCase()
  if (output.some((existing) => `${existing.side}|${existing.source}|${existing.label}|${existing.summary}`.toLowerCase() === key)) return
  output.push({ side: row.side, source: row.source, label: row.label, path: row.path, summary })
}

async function rosterStartRoundRules(output: GameStartRoundRule[], side: 'player' | 'opponent', roster: BuilderRosterSelection[], sharedCache: Map<string, string>) {
  const uniqueRules = uniqueRosterRules(roster).filter((rule) => Boolean(rule.path))
  await Promise.allSettled(uniqueRules.map(async (rule) => {
    const key = `${rule.label.toLowerCase()}|${rule.path}`
    if (sharedCache.has(key)) return
    sharedCache.set(key, await ruleDocumentSummary(rule.path, startRoundTextPattern))
  }))
  for (const unit of roster) for (const rule of unit.specialRules || []) {
    if (!rule.path) continue
    const key = `${rule.label.toLowerCase()}|${rule.path}`
    const summary = sharedCache.get(key) || ''
    if (!summary) continue
    await addStartRoundReference(output, { side, source: unit.name, label: rule.label, path: rule.path, text: summary })
  }
}

export async function loadStartOfRoundGuidance(game: SavedGame): Promise<GameStartRoundRule[]> {
  const output: GameStartRoundRule[] = []
  const friendly = game.playerRoster?.length ? game.playerRoster : (getSavedArmyList(game.playerListId)?.roster || [])
  const enemy = game.opponentRoster?.length ? game.opponentRoster : (game.opponentListId ? getSavedArmyList(game.opponentListId)?.roster || [] : [])
  const sharedRuleCache = new Map<string, string>()
  await Promise.all([rosterStartRoundRules(output, 'player', friendly, sharedRuleCache), rosterStartRoundRules(output, 'opponent', enemy, sharedRuleCache)])

  if (game.scenarioGuidance) await addStartRoundReference(output, {
    side: 'battle', source: game.scenario, label: 'Scenario', path: game.scenarioGuidance.sourcePath,
    text: game.scenarioGuidance.scenarioRules.join(' '),
  })

  for (const condition of randomHappeningOptions.filter((option) => (game.battlefieldConditions || []).includes(option.id))) {
    await addStartRoundReference(output, { side: 'battle', source: 'Battlefield', label: condition.label, path: condition.path })
  }

  const playerRule = String(game.playerCompositionRule || getSavedArmyList(game.playerListId)?.rule || '')
  if (compositionRulePaths[playerRule]) await addStartRoundReference(output, { side: 'battle', source: 'Friendly battle composition', label: playerRule, path: compositionRulePaths[playerRule] })
  const opponentRule = String(game.opponentCompositionRule || (game.opponentListId ? getSavedArmyList(game.opponentListId)?.rule || '' : ''))
  if (compositionRulePaths[opponentRule]) await addStartRoundReference(output, { side: 'battle', source: 'Enemy battle composition', label: opponentRule, path: compositionRulePaths[opponentRule] })

  const friendlyList = getSavedArmyList(game.playerListId)
  const enemyList = game.opponentListId ? getSavedArmyList(game.opponentListId) : null
  await Promise.all([
    addArmyCompositionStartRound(output, 'player', game.playerArmyId || friendlyList?.army || '', game.playerCompositionName || friendlyList?.compositionName || ''),
    addArmyCompositionStartRound(output, 'opponent', game.opponentArmyId || enemyList?.army || '', game.opponentCompositionName || enemyList?.compositionName || ''),
  ])

  return output
}


export const randomHappeningOptions = [
  { id: 'disruptive-weather', label: 'Disruptive Weather', path: '/battle-march/disruptive-weather' },
  { id: 'wilderness-terrain', label: 'Wilderness Terrain', path: '/battle-march/wilderness-terrain' },
  { id: 'chaos-of-war', label: 'Chaos of War', path: '/battle-march/the-chaos-of-war' },
] as const
