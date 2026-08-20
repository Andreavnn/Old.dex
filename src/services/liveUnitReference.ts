import type { BuilderCategory, ProfileKey, PrototypeUnit, PrototypeWeapon } from '../data/builderPrototype'
import type { RawBuilderUnit, RawRecord } from '../domain/rawArmyData'
import { isRecord } from '../domain/schemas'
import { baseUnitSize, blankProfile, maximumModels, minimumModels, normalizeDisplayLabel, noteText, phaseLabel, slug, specialRuleTone, text } from '../domain/liveUnitShared'
import { normalizeRepositoryPath } from '../data/ruleRepository'
import { fetchRuleDocument } from './ruleContent'
import { extractMechanicalRuleText } from './ruleText'
import { reportAppError } from './appErrors'

function parseProfileTable(dom: Document) {
  const statNames = new Set(['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld', 'Sv', 'Ward', 'Wd', 'Rn'])
  const candidates = Array.from(dom.querySelectorAll('table'))
  const table = candidates.find((candidate) => {
    const headers = Array.from(candidate.querySelectorAll('thead th, tr:first-child th, tr:first-child td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')
    const matches = headers.filter((header) => statNames.has(header)).length
    return matches >= 6 && headers.some((header) => header === 'M') && headers.some((header) => header === 'WS')
  })
  if (!table) return [] as Array<{ name: string; profile: Record<ProfileKey, string> }>
  const headerCells = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')
  const statHeaders = headerCells.filter((header) => statNames.has(header))
  const rows = Array.from(table.querySelectorAll('tbody tr'))
  if (!rows.length) rows.push(...Array.from(table.querySelectorAll('tr')).slice(1))
  return rows.map((row) => {
    const cells = Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')
    const profile = blankProfile()
    const offset = Math.max(0, cells.length - statHeaders.length)
    statHeaders.forEach((stat, index) => { const key = stat === 'Wd' ? 'Ward' : stat; profile[key as ProfileKey] = cells[offset + index] || '—' })
    return { name: offset ? cells.slice(0, offset).join(' · ') : '', profile }
  }).filter((row) => Object.values(row.profile).some((value) => value !== '—'))
}

function rawProfileRows(raw: RawBuilderUnit, fallbackName: string) {
  const aliases: Record<ProfileKey, string[]> = {
    M: ['M', 'm', 'movement'], WS: ['WS', 'ws', 'weaponSkill', 'weapon_skill'], BS: ['BS', 'bs', 'ballisticSkill', 'ballistic_skill'],
    S: ['S', 's', 'strength'], T: ['T', 't', 'toughness'], W: ['W', 'w', 'wounds'], I: ['I', 'i', 'initiative'], A: ['A', 'a', 'attacks'],
    Ld: ['Ld', 'LD', 'ld', 'leadership'], Sv: ['Sv', 'SV', 'sv', 'save', 'armourSave', 'armorSave'], Ward: ['Ward', 'Wd', 'ward', 'wardSave'], Rn: ['Rn', 'rn', 'regeneration', 'regen'],
  }
  const toProfile = (value: unknown) => {
    if (!isRecord(value)) return null
    const profile = blankProfile()
    let populated = 0
    for (const [stat, keys] of Object.entries(aliases) as Array<[ProfileKey, string[]]>) {
      const found = keys.map((key) => value[key]).find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim() !== '')
      if (found !== undefined) { profile[stat] = String(found).trim(); populated += 1 }
    }
    return populated >= 5 ? profile : null
  }
  const rows: Array<{ name: string; profile: Record<ProfileKey, string> }> = []
  const push = (value: unknown, name = '') => { const profile = toProfile(value); if (profile) rows.push({ name: name || fallbackName, profile }) }
  for (const source of [raw.profile, raw.profiles, raw.characteristics, raw.stats, raw.modelProfiles]) {
    if (!source) continue
    if (Array.isArray(source)) source.forEach((value, index) => { const row = isRecord(value) ? value : {}; push(row.profile || value, text(row.name_en || row.name) || `${fallbackName}${source.length > 1 ? ` ${index + 1}` : ''}`) })
    else if (typeof source === 'object') {
      push(source, fallbackName)
      for (const [name, value] of Object.entries(source)) if (value && typeof value === 'object') push((value as RawRecord).profile || value, String(name))
    }
  }
  const seen = new Set<string>()
  return rows.filter((row) => { const key = `${row.name}|${Object.values(row.profile).join('|')}`; if (seen.has(key)) return false; seen.add(key); return true })
}

function unitReferenceName(value: string) {
  return slug(value).replace(/-(?:unit|regiment)$/i, '')
}

function normalizedProfileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

async function resolveUnitReference(unitId: string, unitName: string, dataKey: string) {
  const directPaths = [...new Set([`/unit/${unitId}`, `/unit/${slug(unitName)}`])]
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


async function enrichSpecialRule(rule: PrototypeUnit['specialRules'][number]) {
  if (!rule.path) return rule
  try {
    const document = await fetchRuleDocument(rule.path)
    const summary = extractMechanicalRuleText(document.html)
    return { ...rule, summary: summary || rule.summary }
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
  'mercenaries', 'monster handlers', 'monster slayer', 'motley crew', 'move and shoot', 'move or shoot',
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

async function enrichWeapon(weapon: PrototypeWeapon, paths: Map<string, string>) {
  const name = weapon.name.trim()
  const path = matchingPath(paths, name, `/weapons-of-war/${slug(name)}`)
  try {
    const document = await fetchRuleDocument(path)
    const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
    const rows = Array.from(dom.querySelectorAll('table tr')).slice(1)
    const cells = rows.flatMap((row) => [Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')]).find((row) => row.length >= 4)
    if (!cells) return { ...weapon, path }
    const referenceRules = cells[3] && !/^[-—]$/.test(cells[3]) ? cells[3].split(/,\s*/).filter(Boolean) : []
    const rules: string[] = []
    for (const rule of [...(weapon.rules || []), ...referenceRules]) if (rule && !rules.some((existing) => existing.toLowerCase() === rule.toLowerCase())) rules.push(rule)
    const ruleLinks = [...(weapon.ruleLinks || [])]
    for (const rule of rules) {
      const link = universalWeaponRuleLink(rule)
      if (link && !ruleLinks.some((existing) => existing.label.toLowerCase() === link.label.toLowerCase())) ruleLinks.push(link)
    }
    const hasNotes = Array.from(dom.querySelectorAll('p, div, li')).some((node) => /^Notes?\s*:/i.test(node.textContent?.replace(/\s+/g, ' ').trim() || ''))
    const hasUniqueRule = Boolean(weapon.hasUniqueRule) || hasNotes || rules.some((rule) => !universalWeaponRuleLink(rule))
    return {
      ...weapon,
      path,
      kind: (String(cells[0] || '').toLowerCase() === 'combat' ? 'melee' : 'missile') as PrototypeWeapon['kind'],
      range: cells[0] || weapon.range,
      strength: cells[1] || weapon.strength,
      ap: (cells[2] || '—').replace(/^-(\d)/, '$1'),
      rules,
      ruleLinks,
      hasUniqueRule,
    }
  } catch (error) {
    reportAppError(error, 'UNIT_WEAPON_REFERENCE', { weapon: weapon.name, path })
    return { ...weapon, path }
  }
}


export async function enrichLiveUnitReference(unit: PrototypeUnit, raw: RawBuilderUnit, category: BuilderCategory, armyName: string, dataKey: string) {
  const rawProfiles = rawProfileRows(raw, unit.name)
  if (rawProfiles.length) { unit.profile = rawProfiles[0].profile; unit.profiles = rawProfiles }

  try {
    const reference = await resolveUnitReference(unit.id, unit.name, dataKey)
    if (!reference) return unit
    const { dom, profiles } = reference
    if (profiles.length) { unit.profile = profiles[0].profile; unit.profiles = profiles }
    const metadata = parseMetadata(dom, raw, category, armyName)
    const hasBuilderMinimum = raw.minimum !== undefined && raw.minimum !== null && Number.isFinite(Number(raw.minimum)) && Number(raw.minimum) > 0
    const hasBuilderMaximum = raw.maximum !== undefined && raw.maximum !== null && Number.isFinite(Number(raw.maximum))
    const bounds = unitSizeBounds(metadata.unitSize)
    if (hasBuilderMinimum || hasBuilderMaximum) {
      unit.minimumModels = minimumModels(raw)
      unit.maximumModels = maximumModels(raw)
      unit.unitSize = baseUnitSize(raw)
      if (unit.basePointsPerModel !== undefined) unit.points = unit.basePointsPerModel * unit.minimumModels
    } else {
      unit.unitSize = metadata.unitSize || unit.unitSize
      if (bounds) {
        unit.minimumModels = Math.max(1, bounds.minimum)
        unit.maximumModels = bounds.maximum
        if (unit.basePointsPerModel !== undefined) unit.points = unit.basePointsPerModel * unit.minimumModels
      }
    }
    const referenceText = dom.body.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (unit.named && /\bmust (?:be|always be|serve as|be chosen as) (?:your|the|this army(?:'s)?) General\b/i.test(referenceText)) unit.mustBeGeneral = true
    if (/\bcannot be (?:your|the) General\b/i.test(referenceText)) unit.cannotBeGeneral = true
    if (unit.mustBeGeneral) {
      const general = unit.equipmentOptions.find((option) => option.kind === 'role' && /^General$/i.test(option.name))
      if (general) { general.default = true; general.locked = true }
    }
    unit.details = { ...unit.details, ...metadata, publication: metadata.publication || unit.details.publication }
    const paths = anchorMap(dom)
    unit.specialRules = await Promise.all(unit.specialRules.map(async (rule) => {
      const path = matchingPath(paths, rule.name, rule.path)
      const tone = specialRuleTone(rule.name)
      return enrichSpecialRule({ ...rule, path, tone, timing: phaseLabel(tone), keywords: [{ label: rule.name, path }] })
    }))
    unit.keywords = [
      { label: metadata.unitCategory || category, path: `/army/${dataKey}` },
      ...(metadata.troopType ? [{ label: metadata.troopType, path: '/troop-types-in-detail' }] : []),
    ]
    unit.weapons = await Promise.all(unit.weapons.map((weapon) => enrichWeapon(weapon, paths)))
    const optionalProfiles: NonNullable<PrototypeUnit['optionalProfiles']> = []
    const profileOptions = unit.equipmentOptions.filter((candidate) => candidate.addsProfile || (candidate.kind === 'mount' && !/^On foot$/i.test(candidate.name)))
    for (const option of profileOptions) {
      const profileName = option.addsProfile || option.name
      if (option.kind === 'mount') {
        const noteModifiers = riderCharacteristicModifiers(option.note || '')
        if (Object.keys(noteModifiers).length) option.riderProfileModifiers = { ...(option.riderProfileModifiers || {}), ...noteModifiers }
      }
      try {
        const optionalReference = await resolveUnitReference(slug(profileName), profileName, dataKey)
        const row = optionalReference?.profiles.find((candidate) => normalizedProfileName(candidate.name).includes(normalizedProfileName(profileName))) || optionalReference?.profiles[0]
        if (row && !optionalProfiles.some((existing) => existing.selectionId === option.id)) {
          const equipment: string[] = []
          for (const label of [...(referenceEquipment(optionalReference!.dom) || []), ...(option.profileEquipment || [])]) if (!equipment.some((existing) => existing.toLowerCase() === label.toLowerCase())) equipment.push(label)
          optionalProfiles.push({ selectionId: option.id, name: profileName, profile: row.profile, equipment })
          if (option.kind === 'mount') {
            const mountText = optionalReference?.dom.body.textContent || ''
            const modifiers = riderCharacteristicModifiers(`${option.note || ''} ${mountText}`)
            if (Object.keys(modifiers).length) option.riderProfileModifiers = { ...(option.riderProfileModifiers || {}), ...modifiers }
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
