import type { BuilderRosterSelection } from '../domain/rosterTypes'
import type { RawBuilderItem, RawBuilderUnit } from '../domain/rawArmyData'
import { loadArmyData } from './armyData'
import { fetchRuleDocument } from './ruleContent'
import { getSavedArmyList } from './savedLists'
import type { GameMagicCaster, GameMagicChoice, SavedGame } from './games'
import { reportAppError } from './appErrors'

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
  const headings = Array.from(dom.querySelectorAll<HTMLElement>('h2,h3,h4,h5'))
  for (const heading of headings) {
    const raw = heading.textContent?.replace(/\s+/g, ' ').trim() || ''
    const signature = /\(Signature Spell\)/i.test(raw)
    const numbered = raw.match(/^([1-6])\.\s*(.+)$/)
    if (!signature && !numbered) continue
    const name = (numbered ? numbered[2] : raw.replace(/\s*\(Signature Spell\)\s*/i, '')).trim()
    if (!name) continue
    choices.push({
      id: signature ? `signature-${slug(name)}` : `${numbered?.[1] || choices.length + 1}-${slug(name)}`,
      name,
      summary: followingText(heading),
      path: `/the-lores-of-magic/${slug(lore)}`,
      signature,
    })
  }
  return choices
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
