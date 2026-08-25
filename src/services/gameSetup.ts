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

function followingSpellDetails(heading: Element) {
  const paragraphs: string[] = []
  let type = ''
  let castingValue = ''
  let range = ''
  let cursor: Element | null = heading.nextElementSibling
  while (cursor && !/^H[1-6]$/.test(cursor.tagName)) {
    for (const row of Array.from(cursor.querySelectorAll('tr'))) {
      const cells = Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '').filter(Boolean)
      if (cells.length < 2) continue
      const label = cells[0].replace(/:$/, '').trim().toLowerCase()
      if (label === 'type') type ||= cells[1]
      else if (label === 'casting value') castingValue ||= cells[1]
      else if (label === 'range') range ||= cells[1]
    }
    const value = cursor.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (value) {
      type ||= value.match(/\bType\s*:?\s*(Magic Missile|Magical Vortex|Enchantment|Hex|Conveyance|Assailment)\b/i)?.[1] || ''
      castingValue ||= value.match(/\bCasting Value\s*:?\s*([^|·]{1,20})/i)?.[1]?.trim() || ''
      range ||= value.match(/\bRange\s*:?\s*([0-9]+(?:\.[0-9]+)?["”']?|Self|Combat)/i)?.[1]?.trim() || ''
    }
    if (cursor.tagName === 'P' && value && !/^(?:Type|Casting Value|Range)\b/i.test(value)) paragraphs.push(value)
    cursor = cursor.nextElementSibling
  }
  return { type, castingValue, range, summary: paragraphs.slice(-1).join(' ').slice(0, 900) }
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
    const details = followingSpellDetails(heading)
    choices.push({ id, name, summary: details.summary, path: `/the-lores-of-magic/${slug(lore)}`, signature, type: details.type || undefined, castingValue: details.castingValue || undefined, range: details.range || undefined })
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
  const fallback: GameScenarioGuidance = { sourcePath, roundLimit: 6, gameLength: 'Most battles last for six rounds.', setupText: '', deploymentText: '', firstTurnText: '', scenarioRules: [], specificTerrain: false, mapImageUrl: undefined }
  try {
    const document = await fetchRuleDocument(sourcePath)
    const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
    const setupRows = sectionBlocks(dom, ['Set-up', 'Setup'])
    const deploymentRows = sectionBlocks(dom, ['Deployment'])
    const firstTurnRows = sectionBlocks(dom, ['First Turn'])
    const lengthRows = sectionBlocks(dom, ['Game Length'])
    const ruleRows = sectionBlocks(dom, ['Scenario Special Rules'])
    const setupText = setupRows.join(' ').slice(0, 1800)
    const deploymentText = deploymentRows.join(' ').slice(0, 2200)
    const firstTurnText = firstTurnRows.join(' ').slice(0, 1200)
    const gameLength = lengthRows.join(' ').slice(0, 1300) || fallback.gameLength
    const specificTerrain = Boolean(setupText && !/^Place terrain as described\.?$/i.test(setupText) && /(?:terrain|feature|hill|wood|woods|building|road|river|stream|marsh|ruin|tower|objective|impassable|battlefield|centre|center|zone)/i.test(setupText))
    const images = Array.from(dom.querySelectorAll<HTMLImageElement>('img[src]'))
    const mapImage = images.find((image) => /(?:deployment|scenario|battlefield|map|zone)/i.test(`${image.alt} ${image.src}`))
    const mapImageUrl = mapImage?.src || undefined
    return {
      sourcePath,
      roundLimit: parseRoundLimit(gameLength),
      gameLength,
      setupText,
      deploymentText,
      firstTurnText,
      scenarioRules: ruleRows.filter((row) => !/^This scenario has no special rules\.?$/i.test(row)).slice(0, 6),
      specificTerrain,
      mapImageUrl,
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

export type GameTurnRule = {
  side: 'player' | 'battle'
  source: string
  label: string
  path?: string
  summary: string
  unitRefs?: Array<{ instanceId: string; name: string }>
  action?: 'rule' | 'declare-charge'
  requiredCharge?: boolean
}

const formationNames = new Set(['close order', 'open order', 'skirmishers'])
const deploymentNamePattern = /\b(?:ambushers?|scouts?|vanguard|reserve|reinforcement|deploy|deployment|hidden|tunnel|tunnelling|tunneling|underground|flank|outflank)\b/i
const deploymentTextPattern = /\b(?:deploy|deployment|deployed|set up|setup|before either side deploys|after both sides have deployed|held in reserve|placed in reserve|reserve|reinforcement|scout|vanguard|ambush)\b/i
const reserveTextPattern = /\b(?:held|placed|kept|start(?:s|ing)?)\s+(?:the battle )?in reserve\b|\breserves?\b|\bambushers?\b/i
const startRoundTextPattern = /\b(?:at|during) the (?:very )?(?:start|beginning) of (?:each|every|the|a) round\b|\b(?:start|beginning) of (?:each|every|the|a) round\b/i

function compactText(value: string) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() }
function sentenceRows(value: string) { return compactText(value).match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(compactText).filter(Boolean) || [] }
function pageSentences(html: string, pattern: RegExp) {
  const mechanical = extractMechanicalRuleText(html)
  if (!mechanical) return [] as string[]
  const seen = new Set<string>()
  return sentenceRows(mechanical).filter((row) => pattern.test(row)).filter((row) => {
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


// Turn guidance uses the same canonical rule documents as profile cards, but caches
// the cleaned sentence list once per rule path. The selected phase/subphase and
// turn context then filter that stable source instead of issuing a new fetch for
// each Your Turn / Enemy's Turn view.
const turnSentenceCache = new Map<string, Promise<string[]>>()

function turnRuleSentences(path: string) {
  if (!path) return Promise.resolve([] as string[])
  const existing = turnSentenceCache.get(path)
  if (existing) return existing
  const pending = (async () => {
    try {
      const document = await fetchRuleDocument(path)
      const mechanical = extractMechanicalRuleText(document.html)
      const seen = new Set<string>()
      return sentenceRows(mechanical).filter((row) => {
        const key = row.toLowerCase()
        if (!row || seen.has(key)) return false
        seen.add(key)
        return true
      })
    } catch (error) {
      reportAppError(error, 'GAME_TURN_RULE_GUIDANCE', { path })
      return [] as string[]
    }
  })()
  turnSentenceCache.set(path, pending)
  return pending
}

const turnStepPatterns: Record<string, RegExp> = {
  'start-of-turn': /\b(?:start|beginning) of (?:your|the|each|every|a) turn\b|\bat the start of (?:your|the|each|every|a) turn\b/i,
  command: /\bcommand (?:sub-?phase|phase)\b|\bduring (?:your|the) command\b/i,
  conjuration: /\bconjuration (?:sub-?phase|phase)\b|\benchantment\b|\bhex\b|\bcast(?:ing)?\b.*\bspell\b|\bdispel(?:ling)?\b/i,
  rally: /\brally fleeing troops\b|\brally (?:sub-?phase|phase)\b|\brally test\b|\brallying\b/i,
  'required-charges': /\brequired charge\b|\bimpetuous\b|\bmust (?:declare )?a charge\b|\bmust charge\b/i,
  'declare-charges': /\bdeclare charges?\b|\bdeclare a charge\b|\bcharge reaction\b|\bwhen (?:this unit|the unit|a unit|it) is charged\b|\bwhen charged\b/i,
  'charge-moves': /\bcharge moves?\b|\bcharge move\b|\bfailed charge\b|\bcharging unit\b/i,
  'compulsory-moves': /\bcompulsory moves?\b|\bcompulsory movement\b|\bfleeing move\b|\brandom movement\b|\breserves?\b|\breinforcement\b/i,
  'remaining-moves': /\bremaining moves?\b|\bremaining movement\b|\bmarch(?:ing)?\b|\bconveyance\b|\bduring (?:your|the) movement phase\b/i,
  'special-shooting': /\bshooting phase\b|\bmagic missile\b|\bspecial shooting\b/i,
  shooting: /\bshooting phase\b|\bshooting attack\b|\bmissile weapon\b|\bstand and shoot\b|\bfire and flee\b/i,
  fight: /\bcombat phase\b|\bfight(?:ing)?\b|\bin initiative order\b|\bmelee\b/i,
  'combat-result': /\bcombat result\b|\bcombat resolution\b/i,
  'break-test': /\bbreak test\b|\bbreak tests\b/i,
  'follow-up': /\bfollow up\b|\bpursu(?:e|it|ing)\b|\brestrain(?:ing)?\b|\bflee from combat\b/i,
  'end-turn': /\bend of (?:your|the|each|every|a) turn\b|\bat the end of (?:your|the|each|every|a) turn\b/i,
}

const enemyTurnCue = /\b(?:enemy|opponent(?:'s)?|opposing player(?:'s)?) turn\b|\bduring (?:an?|the) enemy turn\b|\bduring your opponent(?:'s)? turn\b/i
const reactionCue = /\b(?:charge reaction|when charged|when targeted|when attacked|when hit|when wounded|counter charge|stand and shoot|fire and flee|evasive|dispel|combat phase|break test)\b/i
const ownTurnCue = /\b(?:your|controlling player's) turn\b/i

function stepRelevantSentences(sentences: string[], stepId: string, viewSide: 'player' | 'opponent') {
  const pattern = turnStepPatterns[stepId]
  if (!pattern) return [] as string[]
  const phaseRows = sentences.filter((row) => pattern.test(row))
  if (viewSide === 'player') {
    // On the player's turn, include normal phase rules but omit sentences that are
    // explicitly limited to the opponent's turn unless they also describe a reaction.
    return phaseRows.filter((row) => !enemyTurnCue.test(row) || reactionCue.test(row))
  }
  // During the enemy turn, keep only rules the friendly player can still resolve:
  // reactions, opponent-turn triggers and shared Combat/Break interactions.
  return phaseRows.filter((row) => enemyTurnCue.test(row) || reactionCue.test(row) || (!ownTurnCue.test(row) && ['fight','combat-result','break-test','follow-up'].includes(stepId)))
}

async function rosterTurnRules(roster: BuilderRosterSelection[], stepId: string, viewSide: 'player' | 'opponent') {
  const output: GameTurnRule[] = []
  const uniqueRules = uniqueRosterRules(roster).filter((rule) => Boolean(rule.path))
  const sentences = new Map<string, string[]>()
  await Promise.allSettled(uniqueRules.map(async (rule) => {
    if (!rule.path) return
    sentences.set(`${rule.label.toLowerCase()}|${rule.path}`, await turnRuleSentences(rule.path))
  }))
  for (const unit of roster) for (const rule of unit.specialRules || []) {
    if (!rule.path) continue
    const rows = stepRelevantSentences(sentences.get(`${rule.label.toLowerCase()}|${rule.path}`) || [], stepId, viewSide)
    if (!rows.length) continue
    output.push({ side: 'player', source: unit.name, label: rule.label, path: rule.path, summary: rows.slice(0, 3).join(' '), unitRefs: [{ instanceId: unit.instanceId, name: unit.name }], action: 'rule' })
  }
  const seen = new Set<string>()
  const uniqueRows = output.filter((row) => {
    const key = `${row.source}|${row.label}|${row.summary}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (stepId !== 'required-charges') return uniqueRows

  // Required-charge rules such as Impetuous and Warband are usually shared by
  // many units. Present each rule once and attach every affected unit beneath it.
  const grouped = new Map<string, GameTurnRule>()
  for (const row of uniqueRows) {
    const key = `${row.label}|${row.path || ''}|${row.summary}`.toLowerCase()
    const existing = grouped.get(key)
    if (!existing) { grouped.set(key, { ...row, source: 'Multiple units', unitRefs: [...(row.unitRefs || [])] }); continue }
    const refs = new Map((existing.unitRefs || []).map((ref) => [ref.instanceId, ref]))
    for (const ref of row.unitRefs || []) refs.set(ref.instanceId, ref)
    existing.unitRefs = [...refs.values()]
  }
  return [...grouped.values()]
}

function chargeTestKey(game: SavedGame, side: 'player' | 'opponent', instanceId: string) {
  return `${game.round}:${side}:required-charges:${instanceId}`
}

function declareChargeCandidates(game: SavedGame, roster: BuilderRosterSelection[]): GameTurnRule[] {
  return roster.map((unit) => {
    const result = game.chargeTests?.[chargeTestKey(game, 'player', unit.instanceId)]
    const required = result === 'fail'
    return {
      side: 'player',
      source: unit.name,
      label: required ? 'Required Charge' : 'Declare Charge',
      summary: required
        ? 'This unit failed its required charge test. It must declare a charge if a legal charge is possible.'
        : 'Declare a charge with this unit if it is currently eligible and you wish it to charge.',
      unitRefs: [{ instanceId: unit.instanceId, name: unit.name }],
      action: 'declare-charge',
      requiredCharge: required,
    }
  })
}

async function battleTurnRules(game: SavedGame, stepId: string, viewSide: 'player' | 'opponent') {
  const output: GameTurnRule[] = []
  const add = async (source: string, label: string, path?: string, text = '') => {
    let rows = stepRelevantSentences(sentenceRows(text), stepId, viewSide)
    if (!rows.length && path) rows = stepRelevantSentences(await turnRuleSentences(path), stepId, viewSide)
    if (!rows.length) return
    output.push({ side: 'battle', source, label, path, summary: rows.slice(0, 3).join(' ') })
  }
  if (game.scenarioGuidance) await add(game.scenario, 'Scenario', game.scenarioGuidance.sourcePath, game.scenarioGuidance.scenarioRules.join(' '))
  for (const condition of randomHappeningOptions.filter((option) => (game.battlefieldConditions || []).includes(option.id))) {
    await add('Battlefield', condition.label, condition.path)
  }
  const playerRule = String(game.playerCompositionRule || getSavedArmyList(game.playerListId)?.rule || '')
  if (compositionRulePaths[playerRule]) await add('Friendly battle composition', playerRule, compositionRulePaths[playerRule])
  const opponentRule = String(game.opponentCompositionRule || (game.opponentListId ? getSavedArmyList(game.opponentListId)?.rule || '' : ''))
  if (compositionRulePaths[opponentRule]) await add('Enemy battle composition', opponentRule, compositionRulePaths[opponentRule])
  return output
}

const spellStepTypes: Record<string, Set<string>> = {
  conjuration: new Set(['enchantment', 'hex']),
  'remaining-moves': new Set(['conveyance']),
  'special-shooting': new Set(['magic missile', 'magical vortex']),
  fight: new Set(['assailment']),
}

function normalizedSpellType(choice: GameMagicChoice) {
  const explicit = String(choice.type || '').trim().toLowerCase()
  if (explicit) return explicit
  return String(choice.summary || '').match(/\b(Magic Missile|Magical Vortex|Enchantment|Hex|Conveyance|Assailment)\b/i)?.[1]?.toLowerCase() || ''
}

async function selectedSpellTurnRules(game: SavedGame, stepId: string, viewSide: 'player' | 'opponent'): Promise<GameTurnRule[]> {
  if (viewSide !== 'player' || !spellStepTypes[stepId]) return []
  const output: GameTurnRule[] = []
  for (const savedCaster of game.magicSetup || []) {
    if (savedCaster.kind !== 'Wizard' || !savedCaster.selectedSpellIds?.length) continue
    const caster = { ...savedCaster, availableLores: [...(savedCaster.availableLores || [])], selectedSpellIds: [...savedCaster.selectedSpellIds], choices: savedCaster.choices?.map((choice) => ({ ...choice })) }
    const choices = caster.choices?.some((choice) => normalizedSpellType(choice)) ? caster.choices : await loadMagicChoices(caster)
    const selected = new Set(caster.selectedSpellIds)
    for (const choice of choices) {
      if (!selected.has(choice.id) || !spellStepTypes[stepId].has(normalizedSpellType(choice))) continue
      const details = [choice.type ? `Type: ${choice.type}.` : '', choice.castingValue ? `Casting Value: ${choice.castingValue}.` : '', choice.range ? `Range: ${choice.range}.` : '', choice.summary || ''].filter(Boolean).join(' ')
      output.push({ side: 'player', source: caster.name, label: choice.name, path: choice.path, summary: details })
    }
  }
  return output
}

function enemyTurnCoreGuidance(stepId: string, viewSide: 'player' | 'opponent'): GameTurnRule[] {
  if (viewSide !== 'opponent') return []
  const rows: GameTurnRule[] = []
  if (['conjuration', 'remaining-moves', 'special-shooting'].includes(stepId)) {
    rows.push({ side: 'player', source: 'Core Rules', label: 'Wizardly Dispel', path: '/magic/dispelling-enemy-spells', summary: "When the enemy casts an eligible spell, a friendly Wizard that is allowed to dispel may make a Wizardly Dispel attempt. Check range, Wizard state and any restrictions before rolling." })
    rows.push({ side: 'player', source: 'Core Rules', label: 'Fated Dispel', path: '/magic/dispelling-enemy-spells', summary: 'The friendly player may use the army’s Fated Dispel when permitted by the core magic rules. Track its once-per-turn use separately from Wizardly Dispel attempts.' })
  }
  if (stepId === 'declare-charges') rows.push({ side: 'player', source: 'Core Rules', label: 'Charge Reactions', path: '/the-movement-phase/charge-reactions', summary: 'When an enemy charge is declared against a friendly unit, choose and resolve any legal charge reaction such as Hold, Flee or Stand & Shoot, plus reactions granted by special rules.' })
  if (stepId === 'shooting') rows.push({ side: 'player', source: 'Core Rules', label: 'Resolve Enemy Shooting', path: '/the-shooting-phase', summary: 'During enemy shooting, resolve friendly defensive rules, modifiers, armour/ward/regeneration saves and any reactions or effects triggered when targeted, hit or wounded.' })
  return rows
}

export async function loadTurnStepGuidance(game: SavedGame, stepId: string, viewSide: 'player' | 'opponent'): Promise<GameTurnRule[]> {
  const friendly = game.playerRoster?.length ? game.playerRoster : (getSavedArmyList(game.playerListId)?.roster || [])
  const [spellRules, rosterRules, battleRules] = await Promise.all([
    selectedSpellTurnRules(game, stepId, viewSide),
    stepId === 'declare-charges' && viewSide === 'player' ? Promise.resolve(declareChargeCandidates(game, friendly)) : rosterTurnRules(friendly, stepId, viewSide),
    battleTurnRules(game, stepId, viewSide),
  ])
  const coreRules = enemyTurnCoreGuidance(stepId, viewSide)
  const rows = [...spellRules, ...coreRules, ...rosterRules, ...battleRules]
  const seen = new Set<string>()
  return rows.filter((row) => { const key = `${row.side}|${row.source}|${row.label}|${row.summary}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
}
