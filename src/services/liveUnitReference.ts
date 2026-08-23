import type { BuilderCategory, ProfileKey, PrototypeUnit, PrototypeWeapon } from '../data/builderPrototype'
import type { ArmyDataDocument, RawBuilderItem, RawBuilderUnit, RawRecord } from '../domain/rawArmyData'
import { isRecord } from '../domain/schemas'
import { baseUnitSize, normalizeDisplayLabel, noteText, phaseLabel, slug, specialRuleTone, text } from '../domain/liveUnitShared'
import { normalizeRepositoryPath } from '../data/ruleRepository'
import { fetchRuleDocument } from './ruleContent'
import { extractMechanicalRuleText } from './ruleText'
import { reportAppError } from './appErrors'
import { localizedSourceText } from './language'
import { BASE_PROFILE_KEYS, canonicalOwbProfileRows, normalizedProfileIdentityName, selectCanonicalPrimaryProfile, strictProfileRecord, type CanonicalProfileRow } from '../domain/canonicalProfiles'
import { loadOwbRuleCatalog, resolveOwbRuleFromCatalog, splitOwbSourceList, type OwbRuleCatalog, type OwbRuleIndexEntry } from './owbRuleResolver'



function owbProfileRows(
  entry: OwbRuleIndexEntry | undefined,
  fallbackName: string,
  context: { factionId: string; compositionId: string; rosterUnitId: string; rulesPath: string },
) {
  return canonicalOwbProfileRows(entry, fallbackName, context)
}


function rawUnitForResolvedReference(data: ArmyDataDocument | undefined, catalog: OwbRuleCatalog, path: string) {
  if (!data || !path) return null
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue
    for (const raw of value as RawBuilderUnit[]) {
      const name = text(raw)
      if (!name) continue
      if (resolveOwbRuleFromCatalog(catalog, name)?.path === path) return raw
    }
  }
  return null
}

function parseProfileTable(dom: Document) {
  const statNames = new Set([...BASE_PROFILE_KEYS, 'Sv', 'Save', 'Ward', 'Wd', 'Rn', 'Regen'])
  const tables = Array.from(dom.querySelectorAll('table'))
  for (const table of tables) {
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr')
    if (!headerRow) continue
    const headers = Array.from(headerRow.querySelectorAll('th, td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')
    const positions = new Map<string, number>()
    headers.forEach((header, index) => {
      if (statNames.has(header) && !positions.has(header)) positions.set(header, index)
    })
    if (!BASE_PROFILE_KEYS.every((key) => positions.has(key))) continue

    const firstStat = Math.min(...BASE_PROFILE_KEYS.map((key) => positions.get(key)!))
    const rows = Array.from(table.querySelectorAll('tbody tr'))
    if (!rows.length) rows.push(...Array.from(table.querySelectorAll('tr')).slice(1))
    const parsed: Array<{ name: string; profile: Record<ProfileKey, string> }> = []
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')
      const candidate: Record<string, unknown> = {}
      for (const key of BASE_PROFILE_KEYS) candidate[key] = cells[positions.get(key)!]
      const saveIndex = positions.get('Sv') ?? positions.get('Save')
      const wardIndex = positions.get('Ward') ?? positions.get('Wd')
      const regenIndex = positions.get('Rn') ?? positions.get('Regen')
      if (saveIndex !== undefined) candidate.Sv = cells[saveIndex]
      if (wardIndex !== undefined) candidate.Ward = cells[wardIndex]
      if (regenIndex !== undefined) candidate.Rn = cells[regenIndex]
      const profile = strictProfileRecord(candidate)
      if (!profile) continue
      const name = firstStat > 0 ? cells.slice(0, firstStat).filter(Boolean).join(' · ') : ''
      parsed.push({ name, profile })
    }
    if (parsed.length) return parsed
  }
  return [] as Array<{ name: string; profile: Record<ProfileKey, string> }>
}

function rawProfileRows(raw: RawBuilderUnit, fallbackName: string) {
  const rows: Array<{ name: string; profile: Record<ProfileKey, string> }> = []
  const push = (value: unknown, name = '') => {
    const profile = strictProfileRecord(value)
    if (profile) rows.push({ name: name || fallbackName, profile })
  }
  for (const source of [raw.profile, raw.profiles, raw.characteristics, raw.stats, raw.modelProfiles]) {
    if (!source) continue
    if (Array.isArray(source)) {
      source.forEach((value, index) => {
        const row = isRecord(value) ? value : {}
        push(row.profile || value, text(row.name_en || row.name) || `${fallbackName}${source.length > 1 ? ` ${index + 1}` : ''}`)
      })
    } else if (typeof source === 'object') {
      push(source, fallbackName)
      for (const [name, value] of Object.entries(source)) {
        if (value && typeof value === 'object') push((value as RawRecord).profile || value, String(name))
      }
    }
  }
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.name}|${BASE_PROFILE_KEYS.map((stat) => row.profile[stat]).join('|')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function unitReferenceName(value: string) {
  return slug(value).replace(/-(?:unit|regiment)$/i, '')
}


async function resolveUnitReference(unitId: string, unitName: string, dataKey: string, canonicalPath = '') {
  const directPaths = [...new Set([canonicalPath, `/unit/${unitId}`, `/unit/${slug(unitName)}`].filter(Boolean))]
  let firstDocument: Awaited<ReturnType<typeof fetchRuleDocument>> | null = null
  for (const path of directPaths) {
    try {
      const document = await fetchRuleDocument(path)
      firstDocument ||= document
      const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
      const profiles = parseProfileTable(dom)
      if (profiles.length) return { document, dom, profiles }
    } catch { /* try the next candidate */ }
  }
  try {
    const armyDocument = await fetchRuleDocument(`/army/${dataKey}`)
    const armyDom = new DOMParser().parseFromString(`<main>${armyDocument.html}</main>`, 'text/html')
    const targetNames = new Set([slug(unitName), unitReferenceName(unitName), slug(unitId), unitReferenceName(unitId)])
    const links = Array.from(armyDom.querySelectorAll<HTMLAnchorElement>('a[href],a[data-rule-path],a[data-app-path]'))
    let match: string | null = null
    for (const anchor of links) {
      const label = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
      const path = anchor.dataset.rulePath || anchor.dataset.appPath || normalizeRepositoryPath(anchor.getAttribute('href') || '')
      if (!path?.startsWith('/unit/')) continue
      const pathName = path.replace(/^\/unit\//, '')
      if (targetNames.has(slug(label)) || targetNames.has(unitReferenceName(label)) || targetNames.has(slug(pathName)) || targetNames.has(unitReferenceName(pathName))) { match = path; break }
    }
    if (match && !directPaths.includes(match)) {
      const document = await fetchRuleDocument(match)
      const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
      const profiles = parseProfileTable(dom)
      if (profiles.length) return { document, dom, profiles }
      firstDocument ||= document
    }
  } catch { /* reference chart lookup is a fallback */ }
  if (firstDocument) {
    const dom = new DOMParser().parseFromString(`<main>${firstDocument.html}</main>`, 'text/html')
    return { document: firstDocument, dom, profiles: parseProfileTable(dom) }
  }
  return null
}


export function riderCharacteristicModifiers(source: string) {
  const modifiers: Partial<Record<ProfileKey, number>> = {}
  const characteristicNames: Array<[ProfileKey, string]> = [
    ['WS', 'Weapon\\s+Skill|WS'], ['BS', 'Ballistic\\s+Skill|BS'], ['S', 'Strength|S'], ['T', 'Toughness|T'],
    ['W', 'Wounds?|W'], ['I', 'Initiative|I'], ['A', 'Attacks?|A'], ['Ld', 'Leadership|Ld'],
  ]
  const textValue = source.replace(/\s+/g, ' ').trim()
  // Only interpret bonuses explicitly stated as affecting the rider/character/model
  // while mounted; this avoids mistaking the mount's own profile modifiers for rider bonuses.
  const riderClauses = textValue.split(/(?<=[.;])/).filter((clause) => /\b(?:rider|character|model)\b/i.test(clause) && /\bmount(?:ed|ing)?\b|\brider\b/i.test(clause))
  for (const clause of riderClauses) {
    for (const [key, label] of characteristicNames) {
      const plusFirst = clause.match(new RegExp(`\\+(\\d+)\\s*(?:to\\s+(?:(?:its|the|the\\s+rider(?:'s)?|the\\s+character(?:'s)?|the\\s+model(?:'s)?|rider(?:'s)?|character(?:'s)?|model(?:'s)?)\\s+)?)?(?:${label})\\b`, 'i'))
      const namedFirst = clause.match(new RegExp(`(?:${label})(?:\\s+characteristic)?[^.;]{0,40}?(?:increased|improved|raised|bonus)[^+0-9]{0,14}(?:by\\s+)?\\+?(\\d+)`, 'i'))
      const riderNamed = clause.match(new RegExp(`(?:rider|character|model)(?:'s)?[^.;]{0,28}?(?:${label})[^.;]{0,28}?\\+?(\\d+)`, 'i'))
      const amount = Number(plusFirst?.[1] || namedFirst?.[1] || riderNamed?.[1] || 0)
      if (amount > 0) modifiers[key] = Math.max(modifiers[key] || 0, amount)
    }
  }
  return modifiers
}

function referenceEquipment(dom: Document) {
  const bodyText = dom.body.textContent?.replace(/\u00a0/g, ' ').replace(/[ \t\r\n]+/g, ' ').trim() || ''
  const match = bodyText.match(/Equipment(?:\s*\([^)]*\))?\s*:\s*(.*?)(?=\s*(?:Options|Special Rules|Weapons|Unit Category|Unit Size|Troop Type|Base Size|Publication)(?:\s*\([^)]*\))?\s*:|$)/i)
  return (match?.[1] || '').split(/,|\band\b/i).map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function normalizeUnitSizeLabel(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (/^1$/.test(clean)) return '1 model'
  if (/^\d+$/.test(clean)) return `${clean} models`
  if (/^\d+\+$/.test(clean)) return `${clean} models`
  if (/^\d+\s*[–-]\s*\d+$/.test(clean)) return `${clean} models`
  return clean
}

function unitSizeBounds(value: string) {
  const clean = String(value || '').replace(/models?/ig, '').replace(/\s+/g, ' ').trim()
  const range = clean.match(/^(\d+)\s*[–-]\s*(\d+)$/)
  if (range) return { minimum: Number(range[1]), maximum: Number(range[2]) }
  const open = clean.match(/^(\d+)\+$/)
  if (open) return { minimum: Number(open[1]), maximum: undefined as number | undefined }
  const exact = clean.match(/^(\d+)$/)
  if (exact) { const count = Number(exact[1]); return { minimum: count, maximum: count } }
  return null
}

function parseMetadata(dom: Document, raw: RawBuilderUnit, category: BuilderCategory, armyName: string) {
  const bodyText = dom.body.textContent?.replace(/\u00a0/g, ' ').replace(/[ \t\r\n]+/g, ' ').trim() || ''
  const labels = ['Unit Category', 'Unit Size', 'Troop Type', 'Base Size', 'Publication', 'Equipment', 'Options', 'Special Rules', 'Weapons']
  const field = (label: string) => {
    const stop = labels.filter((candidate) => candidate !== label).map((candidate) => candidate.replace(/ /g, '\\s+')).join('|')
    const match = bodyText.match(new RegExp(`${label.replace(/ /g, '\\s+')}\\s*:\\s*(.*?)(?=\\s*(?:${stop})\\s*:|$)`, 'i'))
    return match?.[1]?.replace(/\s+/g, ' ').trim() || ''
  }
  const unitCategory = field('Unit Category') || category
  const troopType = normalizeDisplayLabel(field('Troop Type'))
  const baseSize = field('Base Size')
  const explicitUnitSize = bodyText.match(/Unit Size:\s*([0-9]+(?:\s*[–-]\s*[0-9]+|\+)?(?:\s*models?)?)/i)?.[1]?.trim() || ''
  const parsedUnitSize = explicitUnitSize || field('Unit Size')
  const unitSize = parsedUnitSize && parsedUnitSize.length <= 80 ? normalizeUnitSizeLabel(parsedUnitSize) : baseUnitSize(raw)
  const publication = field('Publication')
  return { unitCategory, troopType: troopType.slice(0, 120), baseSize: baseSize.slice(0, 80), unitSize, army: armyName, publication: publication.slice(0, 120), notes: noteText(raw.notes) }
}

function anchorMap(dom: Document) {
  const map = new Map<string, string>()
  for (const anchor of Array.from(dom.querySelectorAll<HTMLAnchorElement>('a[href],a[data-rule-path]'))) {
    const label = anchor.textContent?.replace(/\s+/g, ' ').trim()
    if (!label) continue
    const path = anchor.dataset.rulePath || normalizeRepositoryPath(anchor.getAttribute('href') || '')
    if (path) map.set(label.toLowerCase(), path)
  }
  return map
}

function matchingPath(map: Map<string, string>, name: string, fallback: string) {
  const normalized = name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim()
  return map.get(name.toLowerCase()) || map.get(normalized) || [...map.entries()].find(([label]) => label.replace(/s$/, '') === normalized.replace(/s$/, ''))?.[1] || fallback
}


function fallbackReferenceText(html: string, title = '') {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  dom.querySelectorAll('script,style,nav,header,footer,table').forEach((node) => node.remove())
  const wantedTitle = title.toLowerCase().trim()
  const rows = Array.from(dom.querySelectorAll('p, li'))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || '')
    .filter((value) => value.length >= 18 && value.toLowerCase() !== wantedTitle)
    .filter((value) => !/^(publication|source|page|last update|url copied|back source)\b/i.test(value))
  const seen = new Set<string>()
  const unique = rows.filter((value) => { const key = value.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
  // Never promote flavour simply because it is the last paragraph. A fallback
  // sentence must still look like game mechanics; otherwise leave the summary
  // empty and let the linked source page remain the authority.
  const mechanical = unique.filter((value) => /\b(?:may|must|can(?:not|'t)?|cannot|cause|causes|fear|terror|panic|test|roll|re-?roll|save|attack|attacks|wound|wounds|phase|turn|special rule|characteristic|modifier|within|range)\b/i.test(value))
  return mechanical.slice(-2).join(' ').slice(0, 1800)
}

function ruleSummaryLooksIncomplete(value: string) {
  const text = String(value || '').trim()
  if (!text) return true
  return /(?:last update\s*:|back source\s*:|url copied|warhammer:\s*the old world|ravening hordes,?\s*p\.|forces of fantasy,?\s*p\.|arcane journal[^.]*,?\s*p\.)/i.test(text)
}

async function enrichSpecialRule(rule: PrototypeUnit['specialRules'][number]) {
  if (!rule.path) return rule
  try {
    let document = await fetchRuleDocument(rule.path)
    let summary = extractMechanicalRuleText(document.html)
    if (ruleSummaryLooksIncomplete(summary)) {
      try {
        const refreshed = await fetchRuleDocument(rule.path, true)
        const refreshedSummary = extractMechanicalRuleText(refreshed.html)
        if (!ruleSummaryLooksIncomplete(refreshedSummary)) { document = refreshed; summary = refreshedSummary }
      } catch (error) {
        reportAppError(error, 'UNIT_RULE_REFERENCE_REFRESH', { rule: rule.name, path: rule.path })
      }
    }
    if (ruleSummaryLooksIncomplete(summary)) summary = fallbackReferenceText(document.html, rule.name)
    return { ...rule, summary: ruleSummaryLooksIncomplete(summary) ? rule.summary : summary }
  } catch (error) {
    reportAppError(error, 'UNIT_RULE_REFERENCE', { rule: rule.name, path: rule.path })
    return rule
  }
}

const universalWeaponRules = new Set([
  'ambushers', 'armour bane', 'armoured hide', 'breath weapon', 'chariot runners', 'close order', 'counter charge',
  'cumbersome', 'detachment', 'dragged along', 'drilled', 'ethereal', 'evasive', 'extra attacks', 'fast cavalry',
  'fear', 'feigned flight', 'fight in extra rank', 'fire and flee', 'fire flee', 'first charge', 'flaming attacks',
  'flammable', 'fly', 'frenzy', 'furious charge', 'hatred', 'horde', 'howdah', 'ignores cover', 'immune to psychology',
  'impact hits', 'impetuous', 'killing blow', 'large target', 'levies', 'loner', 'magical attacks', 'magic resistance',
  'mercenaries', 'monster handlers', 'monster slayer', 'motley crew', 'move and shoot', 'move or shoot', 'cannon fire',
  'move through cover', 'multiple shots', 'multiple wounds', 'open order', 'poisoned attacks', 'ponderous', 'quick shot',
  'rallying cry', 'random attacks', 'random movement', 'regeneration', 'regimental unit', 'requires two hands',
  'reserve move', 'scouts', 'shieldwall', 'skirmishers', 'stomp attacks', 'strike first', 'strike last', 'stubborn',
  'stupidity', 'swiftstride', 'terror', 'timmm berrr', 'unbreakable', 'unstable', 'vanguard', 'veteran', 'volley fire',
  'warband', 'warp spawned',
])

function weaponRuleBase(value: string) {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/\s*\([^)]*\)\s*/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function universalWeaponRuleLink(value: string) {
  const base = weaponRuleBase(value)
  if (!universalWeaponRules.has(base)) return null
  return { label: value, path: `/special-rules/${slug(base)}` }
}

// Browser-rendered tow.whfb.app weapon pages can occasionally expose a complete
// profile to users while the transport-safe HTML/reader fallback still contains
// a placeholder Special Rules cell. Supplements are keyed to the canonical weapon
// page (never to a unit), are used only when that live cell is empty, and are
// replaced automatically whenever the source starts returning explicit rules.
const weaponReferenceSupplements: Record<string, Array<{ label: string; path: string }>> = {
  '/weapons-of-war/grand-cannon': [
    { label: 'Armour Bane (3)', path: '/special-rules/armour-bane' },
    { label: 'Cannon Fire', path: '/special-rules/cannon-fire' },
    { label: 'Cumbersome', path: '/special-rules/cumbersome' },
    { label: 'Move or Shoot', path: '/special-rules/move-or-shoot' },
    { label: 'Multiple Wounds (D3+1)', path: '/special-rules/multiple-wounds' },
    { label: 'Thunderous Impact', path: '/special-rules/thunderous-impact' },
  ],
}

type WeaponReferenceParse = {
  cells: string[]
  referenceRules: string[]
  ruleLinks: Array<{ label: string; path: string }>
  noteRules: string[]
  noteRuleLinks: Array<{ label: string; path: string }>
  hasExplicitSpecialRules: boolean
  hasNotes: boolean
}

function cleanWeaponRuleLabel(value: string, weaponName: string) {
  const label = value.replace(/\s+/g, ' ').trim().replace(/^[•·\-–—]+\s*/, '').replace(/\s*[•·]+$/, '')
  if (!label || /^[-–—]$/.test(label)) return ''
  if (weaponRuleBase(label) === weaponRuleBase(weaponName)) return ''
  if (/^black powder misfire table$/i.test(label)) return ''
  return label
}

function splitWeaponRules(value: string, weaponName: string) {
  return value
    .split(/\s*(?:,|;|\n|\r|•|·)\s*/)
    .map((entry) => cleanWeaponRuleLabel(entry, weaponName))
    .filter(Boolean)
}

function parseWeaponReference(document: Awaited<ReturnType<typeof fetchRuleDocument>>, weaponName: string): WeaponReferenceParse | null {
  const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
  const tables = Array.from(dom.querySelectorAll('table'))
  const table = tables.find((candidate) => {
    const headings = Array.from(candidate.querySelectorAll('tr:first-child th, thead th')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || '')
    return headings.some((heading) => heading === 'range') && headings.some((heading) => heading === 'strength') && headings.some((heading) => /armour piercing|armor piercing|^ap$/.test(heading))
  }) || tables[0]
  if (!table) return null

  const row = Array.from(table.querySelectorAll('tbody tr, tr')).find((candidate, index) => {
    if (index === 0 && !table.querySelector('tbody')) return false
    return candidate.querySelectorAll('td').length >= 4
  })
  if (!row) return null
  const cellNodes = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'))
  const cells = cellNodes.map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')
  if (cells.length < 4) return null

  const specialCell = cellNodes[3]
  const referenceRules: string[] = []
  const ruleLinks: Array<{ label: string; path: string }> = []
  for (const anchor of Array.from(specialCell.querySelectorAll<HTMLAnchorElement>('a[href],a[data-rule-path],a[data-app-path]'))) {
    const label = cleanWeaponRuleLabel(anchor.textContent || '', weaponName)
    const rulePath = anchor.dataset.rulePath || anchor.dataset.appPath || normalizeRepositoryPath(anchor.getAttribute('href') || '')
    if (!label) continue
    if (!referenceRules.some((existing) => existing.toLowerCase() === label.toLowerCase())) referenceRules.push(label)
    if (rulePath && !ruleLinks.some((existing) => existing.label.toLowerCase() === label.toLowerCase() && existing.path === rulePath)) ruleLinks.push({ label, path: rulePath })
  }
  for (const label of splitWeaponRules(cells[3], weaponName)) if (!referenceRules.some((existing) => existing.toLowerCase() === label.toLowerCase())) referenceRules.push(label)

  const noteRules: string[] = []
  const noteRuleLinks: Array<{ label: string; path: string }> = []
  const noteNodes = Array.from(dom.querySelectorAll('p, div, li')).filter((node) => /^Notes?\s*:/i.test(node.textContent?.replace(/\s+/g, ' ').trim() || ''))
  for (const node of noteNodes) {
    for (const anchor of Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href],a[data-rule-path],a[data-app-path]'))) {
      const label = cleanWeaponRuleLabel(anchor.textContent || '', weaponName)
      const notePath = anchor.dataset.rulePath || anchor.dataset.appPath || normalizeRepositoryPath(anchor.getAttribute('href') || '')
      if (!label || !notePath) continue
      // Notes may link to reference tables as well as special rules. Only promote
      // actual special-rule links (or known universal special rules) into the
      // weapon's Special Rules column. This keeps misfire-table links in Notes
      // instead of incorrectly presenting them as weapon special rules.
      const specialRuleLink = notePath.startsWith('/special-rules/') || Boolean(universalWeaponRuleLink(label))
      if (!specialRuleLink) continue
      if (!noteRules.some((existing) => existing.toLowerCase() === label.toLowerCase())) noteRules.push(label)
      if (!noteRuleLinks.some((existing) => existing.label.toLowerCase() === label.toLowerCase() && existing.path === notePath)) noteRuleLinks.push({ label, path: notePath })
    }
  }

  return {
    cells,
    referenceRules,
    ruleLinks,
    noteRules,
    noteRuleLinks,
    hasExplicitSpecialRules: referenceRules.length > 0,
    hasNotes: noteNodes.length > 0,
  }
}

async function enrichWeapon(weapon: PrototypeWeapon, paths: Map<string, string>, catalog: OwbRuleCatalog) {
  const name = (weapon.sourceName || weapon.name).trim()
  const resolved = resolveOwbRuleFromCatalog(catalog, name)
  const path = resolved?.path || matchingPath(paths, name, '')
  if (!path) return weapon
  try {
    let document = await fetchRuleDocument(path)
    let parsed = parseWeaponReference(document, name)
    // A cached/source-rendered page can occasionally contain the weapon profile
    // while omitting the browser-rendered Special Rules cell. Retry the live
    // source once without cache before accepting an incomplete weapon profile.
    if (parsed && !parsed.hasExplicitSpecialRules) {
      try {
        const refreshed = await fetchRuleDocument(path, true)
        const refreshedParsed = parseWeaponReference(refreshed, name)
        if (refreshedParsed && (refreshedParsed.hasExplicitSpecialRules || !parsed)) {
          document = refreshed
          parsed = refreshedParsed
        }
      } catch (error) {
        reportAppError(error, 'UNIT_WEAPON_REFERENCE_REFRESH', { weapon: weapon.name, path })
      }
    }
    if (!parsed) return { ...weapon, path }

    const supplement = !parsed.hasExplicitSpecialRules ? (weaponReferenceSupplements[path] || []) : []
    const rules: string[] = []
    for (const rule of [...(weapon.rules || []), ...parsed.referenceRules, ...parsed.noteRules, ...supplement.map((entry) => entry.label)]) {
      const label = cleanWeaponRuleLabel(rule, name)
      if (label && !rules.some((existing) => existing.toLowerCase() === label.toLowerCase())) rules.push(label)
    }
    const ruleLinks = [...(weapon.ruleLinks || [])].filter((link) => cleanWeaponRuleLabel(link.label, name))
    for (const link of [...parsed.ruleLinks, ...parsed.noteRuleLinks, ...supplement]) {
      if (!ruleLinks.some((existing) => existing.label.toLowerCase() === link.label.toLowerCase() && existing.path === link.path)) ruleLinks.push(link)
    }
    for (const rule of rules) {
      const existing = ruleLinks.find((link) => link.label.toLowerCase() === rule.toLowerCase())
      if (existing) continue
      const resolvedRule = resolveOwbRuleFromCatalog(catalog, rule)
      const link = resolvedRule?.path ? { label: rule, path: resolvedRule.path } : universalWeaponRuleLink(rule)
      if (link) ruleLinks.push(link)
    }

    const hasUniqueRule = Boolean(weapon.hasUniqueRule) || parsed.hasNotes || rules.some((rule) => !universalWeaponRuleLink(rule))
    return {
      ...weapon,
      path,
      kind: (String(parsed.cells[0] || '').toLowerCase() === 'combat' ? 'melee' : 'missile') as PrototypeWeapon['kind'],
      range: parsed.cells[0] || weapon.range,
      strength: parsed.cells[1] || weapon.strength,
      ap: (parsed.cells[2] || '—').replace(/^-(\d)/, '$1'),
      rules,
      ruleLinks,
      hasUniqueRule,
    }
  } catch (error) {
    reportAppError(error, 'UNIT_WEAPON_REFERENCE', { weapon: weapon.name, path })
    return { ...weapon, path }
  }
}


export async function enrichLiveUnitReference(unit: PrototypeUnit, raw: RawBuilderUnit, category: BuilderCategory, armyName: string, dataKey: string, compositionId = '', armyData?: ArmyDataDocument) {
  const ruleCatalog = await loadOwbRuleCatalog()
  const unitSourceName = unit.sourceName || unit.name
  const unitIndex = resolveOwbRuleFromCatalog(ruleCatalog, unitSourceName)
  const indexedProfiles = owbProfileRows(unitIndex?.entry, unit.name, {
    factionId: dataKey,
    compositionId,
    rosterUnitId: unit.id,
    rulesPath: unitIndex?.path || '',
  })
  const indexedPrimary = selectCanonicalPrimaryProfile(indexedProfiles, [unitSourceName, unit.name, unit.id])
  if (indexedProfiles.length) unit.profiles = indexedProfiles
  if (indexedPrimary) {
    unit.profile = indexedPrimary.profile
    unit.profileIdentity = indexedPrimary.identity
  }
  if (unitIndex?.entry.troopType && !unit.details.troopType) unit.details.troopType = String(unitIndex.entry.troopType)
  if (unitIndex?.entry.page) unit.details.publication = String(unitIndex.entry.page)

  try {
    const reference = await resolveUnitReference(unit.id, unitSourceName, dataKey, unitIndex?.path || '')
    const dom = reference?.dom || new DOMParser().parseFromString('<main></main>', 'text/html')
    const profiles = reference?.profiles || []
    if (!indexedProfiles.length && profiles.length) {
      const ruleRows: CanonicalProfileRow[] = profiles.map((row, index) => ({
        ...row,
        identity: {
          factionId: dataKey,
          compositionId,
          rosterUnitId: unit.id,
          rulesPath: reference?.document.sourcePath || unitIndex?.path || '',
          profileId: normalizedProfileIdentityName(row.name || `${unit.name}-${index + 1}`).replace(/\s+/g, '-') || `profile-${index + 1}`,
          source: 'rules-page',
        },
      }))
      const rulePrimary = selectCanonicalPrimaryProfile(ruleRows, [unitSourceName, unit.name, unit.id])
      unit.profiles = ruleRows
      if (rulePrimary) {
        unit.profile = rulePrimary.profile
        unit.profileIdentity = rulePrimary.identity
      }
    }
    if (!indexedProfiles.length && !profiles.length) {
      const rawProfiles = rawProfileRows(raw, unit.name)
      if (rawProfiles.length) {
        const canonicalRawRows: CanonicalProfileRow[] = rawProfiles.map((row, index) => ({
          ...row,
          identity: {
            factionId: dataKey,
            compositionId,
            rosterUnitId: unit.id,
            rulesPath: '',
            profileId: normalizedProfileIdentityName(row.name || `${unit.name}-${index + 1}`).replace(/\s+/g, '-') || `profile-${index + 1}`,
            source: 'builder-raw',
          },
        }))
        const rawPrimary = selectCanonicalPrimaryProfile(canonicalRawRows, [unitSourceName, unit.name, unit.id])
        unit.profiles = canonicalRawRows
        if (rawPrimary) {
          unit.profile = rawPrimary.profile
          unit.profileIdentity = rawPrimary.identity
        }
      }
    }
    const metadata = reference ? parseMetadata(dom, raw, category, armyName) : { unitCategory: category, troopType: unit.details.troopType || '', baseSize: unit.details.baseSize || '', unitSize: unit.unitSize, army: armyName, publication: unit.details.publication || '', notes: noteText(raw.notes) }
    const composition = isRecord(raw.armyComposition) && isRecord(raw.armyComposition[compositionId]) ? raw.armyComposition[compositionId] : null
    const hasBuilderMinimum = (raw.minimum !== undefined && raw.minimum !== null && Number.isFinite(Number(raw.minimum)) && Number(raw.minimum) > 0) || (composition?.minimum !== undefined && Number.isFinite(Number(composition.minimum)) && Number(composition.minimum) > 0)
    const hasBuilderMaximum = (raw.maximum !== undefined && raw.maximum !== null && Number.isFinite(Number(raw.maximum))) || (composition?.maximum !== undefined && Number.isFinite(Number(composition.maximum)))
    const bounds = unitSizeBounds(metadata.unitSize)
    if (hasBuilderMinimum || hasBuilderMaximum) {
      // The Builder JSON (including army-composition overrides) is authoritative.
      // makeCatalogUnit already normalized those values; reference-page metadata is
      // only a fallback for units where OWB itself does not provide structured size data.
      if (unit.basePointsPerModel !== undefined) unit.points = unit.basePointsPerModel * (unit.minimumModels ?? 1)
    } else {
      unit.unitSize = metadata.unitSize || unit.unitSize
      if (bounds) {
        unit.minimumModels = Math.max(1, bounds.minimum)
        unit.maximumModels = bounds.maximum
        if (unit.basePointsPerModel !== undefined) unit.points = unit.basePointsPerModel * (unit.minimumModels ?? 1)
      }
    }
    const referenceText = dom.body.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (unit.named && /\bmust (?:be|always be|serve as|be chosen as) (?:your|the|this army(?:'s)?) General\b/i.test(referenceText)) unit.mustBeGeneral = true
    if (/\bcannot be (?:your|the) General\b/i.test(referenceText)) unit.cannotBeGeneral = true
    if (unit.mustBeGeneral) {
      const general = unit.equipmentOptions.find((option) => option.kind === 'role' && /^General$/i.test(option.sourceName || option.name))
      if (general) { general.default = true; general.locked = true }
    }
    unit.details = { ...unit.details, ...metadata, publication: metadata.publication || unit.details.publication }
    const paths = anchorMap(dom)
    unit.specialRules = await Promise.all(unit.specialRules.map(async (rule) => {
      const ruleSourceName = rule.sourceName || rule.name
      const resolvedRule = resolveOwbRuleFromCatalog(ruleCatalog, ruleSourceName)
      const path = resolvedRule?.path || matchingPath(paths, ruleSourceName, rule.path)
      const tone = specialRuleTone(ruleSourceName)
      return enrichSpecialRule({ ...rule, path, tone, timing: phaseLabel(tone), keywords: [{ label: rule.name, path }] })
    }))
    unit.keywords = [
      { label: metadata.unitCategory || category, path: `/army/${dataKey}` },
      ...(metadata.troopType ? [{ label: metadata.troopType, path: '/troop-types-in-detail' }] : []),
    ]
    unit.weapons = await Promise.all(unit.weapons.map((weapon) => enrichWeapon(weapon, paths, ruleCatalog)))
    const optionalProfiles: NonNullable<PrototypeUnit['optionalProfiles']> = []
    const profileOptions = unit.equipmentOptions.filter((candidate) => candidate.addsProfile || (candidate.kind === 'mount' && !/^On foot$/i.test(candidate.sourceName || candidate.name)))
    for (const option of profileOptions) {
      const profileName = option.addsProfile || option.name
      const profileSourceName = option.sourceName || profileName
      if (option.kind === 'mount') {
        const noteModifiers = riderCharacteristicModifiers(option.note || '')
        if (Object.keys(noteModifiers).length) option.riderProfileModifiers = { ...(option.riderProfileModifiers || {}), ...noteModifiers }
      }
      try {
        const resolvedProfile = resolveOwbRuleFromCatalog(ruleCatalog, profileSourceName)
        const indexed = owbProfileRows(resolvedProfile?.entry, profileName, {
          factionId: dataKey,
          compositionId,
          rosterUnitId: unit.id,
          rulesPath: resolvedProfile?.path || '',
        })
        const optionalReference = await resolveUnitReference(slug(profileSourceName), profileSourceName, dataKey, resolvedProfile?.path || '')
        const indexedRow = selectCanonicalPrimaryProfile(indexed, [profileSourceName, profileName])
        const rawReferenceRow = optionalReference ? selectCanonicalPrimaryProfile(optionalReference.profiles, [profileSourceName, profileName]) : null
        const referenceRow: CanonicalProfileRow | null = rawReferenceRow ? {
          ...rawReferenceRow,
          identity: {
            factionId: dataKey,
            compositionId,
            rosterUnitId: unit.id,
            rulesPath: optionalReference?.document.sourcePath || resolvedProfile?.path || '',
            profileId: normalizedProfileIdentityName(rawReferenceRow.name || profileName).replace(/\s+/g, '-') || normalizedProfileIdentityName(profileName).replace(/\s+/g, '-'),
            source: 'rules-page',
          },
        } : null
        const row = indexedRow || referenceRow
        if (row && !optionalProfiles.some((existing) => existing.selectionId === option.id)) {
          const equipment: string[] = []
          const referencedRaw = rawUnitForResolvedReference(armyData, ruleCatalog, resolvedProfile?.path || '')
          const rawEquipment = referencedRaw && Array.isArray(referencedRaw.equipment) ? referencedRaw.equipment.map((entry: RawBuilderItem) => text(entry)).filter(Boolean) : []
          for (const label of [...(optionalReference ? referenceEquipment(optionalReference.dom) : []), ...rawEquipment, ...(option.profileEquipment || [])]) if (!equipment.some((existing) => existing.toLowerCase() === label.toLowerCase())) equipment.push(label)
          optionalProfiles.push({ selectionId: option.id, name: profileName, sourceName: profileSourceName, profile: row.profile, identity: row.identity, equipment })
          if (option.kind === 'mount') {
            const mountText = optionalReference?.dom.body.textContent || ''
            const modifiers = riderCharacteristicModifiers(`${option.note || ''} ${mountText}`)
            if (Object.keys(modifiers).length) option.riderProfileModifiers = { ...(option.riderProfileModifiers || {}), ...modifiers }
            if (referencedRaw?.specialRules) {
              const sourceNames = splitOwbSourceList(text(referencedRaw.specialRules), ruleCatalog)
              const displayNames = splitOwbSourceList(localizedSourceText(referencedRaw.specialRules) || text(referencedRaw.specialRules))
              for (const [index, sourceName] of sourceNames.entries()) {
                if (unit.specialRules.some((rule) => (rule.sourceName || rule.name).toLowerCase() === sourceName.toLowerCase() && rule.requiresSelection === option.id)) continue
                const resolvedRule = resolveOwbRuleFromCatalog(ruleCatalog, sourceName)
                const tone = specialRuleTone(sourceName)
                unit.specialRules.push(await enrichSpecialRule({ name: displayNames[index] || sourceName, sourceName, path: resolvedRule?.path || '', timing: phaseLabel(tone), tone, summary: '', keywords: [], requiresSelection: option.id }))
              }
            }
          }
        }
      } catch (error) {
        reportAppError(error, 'UNIT_OPTIONAL_PROFILE_REFERENCE', { unitId: unit.id, optionId: option.id, dataKey })
      }
    }
    if (optionalProfiles.length) unit.optionalProfiles = optionalProfiles
  } catch (error) {
    reportAppError(error, 'UNIT_REFERENCE_ENRICHMENT', { unitId: unit.id, dataKey })
  }
  return unit
}
