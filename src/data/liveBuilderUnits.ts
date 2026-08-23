import { type BuilderCategory, type PrototypeEquipmentOption, type PrototypeUnit, type PrototypeWeapon } from './builderPrototype'
import { loadArmyData } from '../services/armyData'
import { enrichLiveUnitReference } from '../services/liveUnitReference'
import { wizardLevelFromName } from '../domain/wizard'
import { inferEquipmentOptionDependencies } from '../domain/optionDependencies'
import { isRecord } from '../domain/schemas'
import type { ArmyDataDocument, RawBuilderItem, RawBuilderUnit } from '../domain/rawArmyData'
import { baseUnitSize, blankProfile, maximumModels, minimumModels, noteText, phaseLabel, slug, specialRuleTone, text } from '../domain/liveUnitShared'
import { loadOwbRuleCatalog, resolveOwbRuleFromCatalog, splitOwbSourceList, type OwbRuleCatalog } from '../services/owbRuleResolver'
import { localizedSourceText } from '../services/language'
import { canonicalOwbProfileRows, selectCanonicalPrimaryProfile } from '../domain/canonicalProfiles'
import { customUnitForArmy, customUnitsForArmy } from '../services/customData'

export type { RawBuilderUnit } from '../domain/rawArmyData'

function displayText(value: unknown) { return localizedSourceText(value) || text(value) }

const categoryMap: Record<string, BuilderCategory> = {
  characters: 'Characters', character: 'Characters', lords: 'Characters', lord: 'Characters', heroes: 'Characters', hero: 'Characters',
  core: 'Core', special: 'Special', rare: 'Rare',
  mercenaries: 'Mercenaries', mercenary: 'Mercenaries', allies: 'Allies', ally: 'Allies',
}

function compositionCategory(raw: RawBuilderUnit, compositionId: string, sourceKey: string): BuilderCategory | null {
  const composition = raw.armyComposition
  if (isRecord(composition)) {
    const entry = composition[compositionId]
    if (!entry) return null
    if (isRecord(entry)) return categoryMap[String(entry.category || sourceKey).toLowerCase()] || null
    return categoryMap[sourceKey.toLowerCase()] || null
  }
  if (typeof composition === 'string' && composition !== compositionId) return null
  if (Array.isArray(composition) && !composition.includes(compositionId)) return null
  return categoryMap[sourceKey.toLowerCase()] || null
}

function compositionRecord(raw: RawBuilderUnit, compositionId: string) {
  const composition = raw.armyComposition
  if (!compositionId || !isRecord(composition)) return null
  const entry = composition[compositionId]
  return isRecord(entry) ? entry : null
}

function sourceAppliesToComposition(item: RawBuilderItem, compositionId: string) {
  const scope = item.armyComposition
  if (!scope || !compositionId) return true
  if (typeof scope === 'string') return scope === compositionId
  if (Array.isArray(scope)) return scope.map(String).includes(compositionId)
  if (isRecord(scope)) return Boolean(scope[compositionId])
  return true
}

function compositionModelBounds(raw: RawBuilderUnit, compositionId: string) {
  const entry = compositionRecord(raw, compositionId)
  const entryMinimum = Number(entry?.minimum)
  const entryMaximum = Number(entry?.maximum)
  const minimum = Number.isFinite(entryMinimum) && entryMinimum > 0 ? entryMinimum : minimumModels(raw)
  const maximum = Number.isFinite(entryMaximum) && entryMaximum > 0 ? entryMaximum : maximumModels(raw)
  return { minimum, maximum }
}

function compositionPointsPerModel(raw: RawBuilderUnit, compositionId: string) {
  const entry = compositionRecord(raw, compositionId)
  const points = Number(entry?.points)
  return Number.isFinite(points) && points >= 0 ? points : Number(raw.points || 0)
}

function compositionUnitSize(raw: RawBuilderUnit, compositionId: string) {
  const { minimum, maximum } = compositionModelBounds(raw, compositionId)
  if (minimum <= 1 && maximum === 1) return '1 model'
  if (maximum && maximum === minimum) return `${minimum} models`
  if (maximum && maximum > minimum) return `${minimum}–${maximum} models`
  if (minimum > 0) return `${minimum}+ models`
  return baseUnitSize(raw)
}

function baseSelectionPoints(raw: RawBuilderUnit, compositionId: string) {
  const { minimum } = compositionModelBounds(raw, compositionId)
  return compositionPointsPerModel(raw, compositionId) * minimum
}

function armourSaveFromName(name: string) {
  const n = name.toLowerCase()
  const explicit = n.match(/\b([2-6])\+\b/)
  if (explicit) return `${explicit[1]}+`
  if (n.includes('full plate')) return '4+'
  if (n.includes('heavy armour') || n.includes('heavy armor')) return '5+'
  if (n.includes('light armour') || n.includes('light armor')) return '6+'
  return undefined
}

function weaponLike(name: string) {
  return /weapon|spear|pike|glaive|halberd|lance|flail|whip|staff|stave|sword|blade|axe|hammer|mace|maul|club|dagger|knife|cleaver|choppa|stabba|scythe|pick|ironfist|claw|talon|fist|bow|crossbow|longbow|shortbow|warbow|javelin|throwing|sling|pistol|handgun|gun|rifle|firearm|blowpipe|bomb|grenade|bolt thrower|stone thrower|catapult|ballista|trebuchet|mortar|lobber|doom diver|cannon/i.test(name)
}

function missileLike(name: string) {
  return /bow|crossbow|longbow|shortbow|warbow|javelin|throwing|sling|pistol|handgun|gun|rifle|firearm|blowpipe|bomb|grenade|bolt thrower|stone thrower|ballista|trebuchet|mortar|catapult|lobber|cannon|doom diver|rock lobber/i.test(name)
}

function unitWidePerModelRule(name: string) {
  return /^(?:Stubborn|Veteran)$/i.test(name.trim())
}

function sourceRuleValue(item: RawBuilderItem | RawBuilderUnit) {
  return item?.specialRules ?? item?.special_rules ?? item?.rules ?? item?.rule ?? ''
}

function sourceRuleNames(item: RawBuilderItem | RawBuilderUnit, catalog?: OwbRuleCatalog) {
  const value = sourceRuleValue(item)
  const rows = Array.isArray(value) ? value : [value]
  const names: string[] = []
  for (const row of rows) {
    const valueText = text(row) || (typeof row === 'string' ? row : '')
    for (const name of splitOwbSourceList(String(valueText || ''), catalog)) {
      if (!names.some((existing) => existing.toLowerCase() === name.toLowerCase())) names.push(name)
    }
  }
  return names
}

function sourceRuleText(item: RawBuilderItem | RawBuilderUnit, catalog?: OwbRuleCatalog) { return sourceRuleNames(item, catalog).join(', ') }

function sourceIncluded(item: RawBuilderItem) { return Boolean(item?.active || item?.alwaysActive || item?.equippedDefault) }
function sourceAlwaysIncluded(item: RawBuilderItem) { return Boolean(item?.alwaysActive) }

function wizardLevelValue(value: unknown) { return wizardLevelFromName(text(value)) }

function sourceWizardStartingLevel(raw: RawBuilderUnit) {
  const marked: number[] = []
  const scan = (items: RawBuilderItem[]) => {
    for (const item of items || []) {
      const level = wizardLevelValue(item)
      if (level > 0 && sourceIncluded(item)) marked.push(level)
      if (Array.isArray(item?.options)) scan(item.options)
    }
  }
  scan([...(Array.isArray(raw.options) ? raw.options : []), ...(Array.isArray(raw.command) ? raw.command : [])])
  if (marked.length) return Math.min(...marked)
  const fromRules = sourceRuleText(raw).match(/(?:Level\s*(\d+)\s*Wizard|Wizard\s*Level\s*(\d+))/i)
  return fromRules ? Number(fromRules[1] || fromRules[2] || 0) : 0
}

function selectableId(item: RawBuilderItem, prefix: string) {
  const name = text(item)
  return String(item?.id || `${prefix}-${slug(name)}`)
}

function descriptorParts(name: string, catalog?: OwbRuleCatalog) {
  return splitOwbSourceList(name, catalog)
}

function splitWeaponDescriptor(name: string, catalog?: OwbRuleCatalog) {
  const parts = descriptorParts(name, catalog)
  const isWeapon = (part: string) => resolveOwbRuleFromCatalog(catalog || { rules: {}, synonyms: {} }, part)?.path.startsWith('/weapons-of-war/') || weaponLike(part)
  return { weaponParts: parts.filter(isWeapon), nonWeaponParts: parts.filter((part) => !isWeapon(part)) }
}

function mountedOnlyNote(value: unknown) {
  return /appropriately mounted|if mounted|when mounted|while mounted|s[’']il est monté|wenn beritten/i.test(noteText(value))
}

function mixedArmamentRule(raw: RawBuilderUnit) {
  return /motley crew|mixed armament|mixed weapons|diverse armament/i.test(sourceRuleText(raw))
}

function handWeaponExplicitlyExcluded(raw: RawBuilderUnit) {
  if (raw?.noHandWeapon === true || raw?.handWeapon === false) return true
  const source = [noteText(raw?.notes), sourceRuleText(raw)].filter(Boolean).join(' ')
  return /(?:does not|doesn't|do not|cannot|can't) (?:have|carry|use|count as having).*hand weapons?|(?:has|have) no hand weapons?|not equipped with (?:a )?hand weapons?/i.test(source)
}

function equipmentRows(raw: RawBuilderUnit, catalog: OwbRuleCatalog, compositionId: string): PrototypeWeapon[] {
  const rows: PrototypeWeapon[] = []
  const seen = new Set<string>()
  const isHandWeapon = (name: string) => /^hand weapons?$/i.test(name.trim())
  const assumeHandWeapon = !handWeaponExplicitlyExcluded(raw)
  const mixedUnit = mixedArmamentRule(raw)
  const addWeapon = (item: RawBuilderItem, prefix: string, options: { fromOption?: boolean; parentId?: string; locked?: boolean; exclusiveGroup?: string; forceAllParts?: boolean } = {}) => {
    if (!sourceAppliesToComposition(item, compositionId)) return
    const descriptor = text(item)
    if (!descriptor) return
    const displayDescriptor = displayText(item) || descriptor
    const allParts = descriptorParts(descriptor, catalog)
    const localizedParts = descriptorParts(displayDescriptor)
    const displayForPart = (part: string) => { const index = allParts.indexOf(part); return index >= 0 ? (localizedParts[index] || part) : part }
    const parsed = splitWeaponDescriptor(descriptor, catalog)
    const weaponParts = options.forceAllParts ? allParts : parsed.weaponParts
    const nonWeaponParts = options.forceAllParts ? [] : parsed.nonWeaponParts
    if (!weaponParts.length) return
    const mixedOwner = Boolean(nonWeaponParts.length)
    const selfSelectionId = selectableId(item, prefix)
    const visibleWeaponParts = weaponParts.filter((name) => !(options.fromOption && weaponParts.length > 1 && isHandWeapon(name) && rows.some((row) => isHandWeapon(row.sourceName || row.name) && (row.default || row.locked))))
    const firstUpgrade = visibleWeaponParts.findIndex((part) => !isHandWeapon(part))
    const costIndex = firstUpgrade >= 0 ? firstUpgrade : 0
    visibleWeaponParts.forEach((name, partIndex) => {
      // Compound source options describe multiple atomic weapons. Do not surface
      // synthetic names such as "Hand weapons, Great weapons". If an option
      // reduces to one actual upgrade, retain its source selection ID so older
      // roster selections continue to resolve after migration.
      const kind: PrototypeWeapon['kind'] = missileLike(name) ? 'missile' : 'melee'
      const baseId = visibleWeaponParts.length === 1 ? selfSelectionId : `${selfSelectionId}-${slug(name)}`
      let id = baseId
      let index = 2
      while (seen.has(id)) id = `${baseId}-${index++}`
      seen.add(id)
      rows.push({
        id,
        name: displayForPart(name),
        sourceName: name,
        kind,
        range: kind === 'missile' ? 'See rule' : 'Combat',
        strength: 'See rule',
        ap: 'See rule',
        rules: sourceRuleNames(item, catalog),
        points: mixedOwner || partIndex !== costIndex ? 0 : Number(item.points || 0),
        // Weapons that are intrinsic to an optional model/profile (for example an
        // Orc Bully's Whip) are conditional defaults: once that owner is selected
        // the weapon is automatically present and cannot be toggled independently.
        default: mixedOwner ? true : (sourceIncluded(item) || (assumeHandWeapon && !options.fromOption && isHandWeapon(name))),
        costMode: Boolean(item.perModel) ? 'per-model' : 'flat',
        selectionMode: (() => {
          const universalHandWeapon = assumeHandWeapon && !options.fromOption && isHandWeapon(name)
          const explicitMixed = Boolean(item.stackable || item.perModelSelection || item.mixedAllocation || item.mixed)
          return !universalHandWeapon && !unitWidePerModelRule(name) && (explicitMixed || (mixedUnit && options.fromOption)) ? 'per-model-count' : 'unit-toggle'
        })(),
        allocationGroup: (() => {
          const explicitMixed = Boolean(item.stackable || item.perModelSelection || item.mixedAllocation || item.mixed)
          if (unitWidePerModelRule(name) || (assumeHandWeapon && !options.fromOption && isHandWeapon(name)) || (!explicitMixed && !(mixedUnit && options.fromOption))) return undefined
          if (item.allocationGroup || item.group || options.exclusiveGroup) return String(item.allocationGroup || item.group || options.exclusiveGroup)
          // Explicit per-model source choices get their own allocation group unless the
          // source declares a shared group. A unit-level mixed-armament rule is the only
          // fallback that intentionally shares capacity across different weapon choices.
          return explicitMixed ? `weapon-choice:${options.parentId || selfSelectionId}` : 'unit-mixed-weapons'
        })(),
        perModel: Boolean(item.perModel),
        stackable: Boolean(item.stackable || (mixedUnit && options.fromOption)) && !unitWidePerModelRule(name) && !(assumeHandWeapon && !options.fromOption && isHandWeapon(name)),
        minimum: Number(item.minimum || 0) > 0 ? Number(item.minimum) : undefined,
        maximum: Number(item.maximum || 0) > 0 ? Number(item.maximum) : undefined,
        rawId: item.id ? String(item.id) : undefined,
        // Old.dex treats source-default selections as included equipment: selected and locked.
        // Non-default choices remain both unchecked and unlocked.
        locked: mixedOwner ? true : (options.locked ?? Boolean(sourceIncluded(item) || (assumeHandWeapon && !options.fromOption && isHandWeapon(name)))),
        alwaysIncluded: Boolean(item.alwaysActive || (assumeHandWeapon && !options.fromOption && isHandWeapon(name))),
        exclusiveGroup: mixedOwner ? undefined : options.exclusiveGroup,
        requiresSelection: mixedOwner ? selfSelectionId : options.parentId,
        requiresMounted: mountedOnlyNote(item.notes),
        note: noteText(item.notes),
      })
    })
  }
  const walkOptions = (items: RawBuilderItem[], prefix: string, parentId?: string) => {
    for (const item of items) {
      if (!sourceAppliesToComposition(item, compositionId)) continue
      const name = text(item)
      const itemId = selectableId(item, prefix)
      const choiceGroup = item?.exclusive ? `${parentId || prefix}-weapon-choice` : undefined
      if (splitWeaponDescriptor(name, catalog).weaponParts.length) addWeapon(item, prefix, { fromOption: true, parentId, exclusiveGroup: choiceGroup })
      const childDescriptor = splitWeaponDescriptor(name, catalog)
      const childParent = childDescriptor.nonWeaponParts.length ? itemId : (childDescriptor.weaponParts.length ? itemId : (name ? itemId : parentId))
      if (Array.isArray(item.options)) walkOptions(item.options, `${itemId}-option`, childParent)
    }
  }
  for (const item of Array.isArray(raw.equipment) ? raw.equipment : []) {
    // Builder equipment rows are mutually exclusive choices, except items such as
    // Hand weapons marked equippedDefault which remain part of the model even
    // when another weapon choice is purchased.
    const itemName = text(item)
    // Hand weapons are retained even when another weapon is purchased. The Builder
    // dataset uses equippedDefault for many of these rows, but some armies only
    // mark the hand weapon active, so treat the zero-point hand weapon itself as
    // persistent rather than as part of the mutually-exclusive upgrade group.
    const group = (item?.equippedDefault || (/^hand weapons?$/i.test(itemName) && Number(item?.points || 0) === 0)) ? undefined : 'unit-weapon-choice'
    addWeapon(item, 'equipment', { exclusiveGroup: group, forceAllParts: true })
  }
  walkOptions(Array.isArray(raw.options) ? raw.options : [], 'option')
  for (const item of Array.isArray(raw.command) ? raw.command : []) {
    if (!sourceAppliesToComposition(item, compositionId)) continue
    const parentId = selectableId(item, 'command')
    if (Array.isArray(item.options)) walkOptions(item.options, `${parentId}-option`, parentId)
  }
  for (const item of Array.isArray(raw.mounts) ? raw.mounts : []) {
    if (!sourceAppliesToComposition(item, compositionId)) continue
    const parentId = `mount-${slug(text(item))}`
    if (Array.isArray(item.options)) walkOptions(item.options, `${parentId}-option`, parentId)
  }
  if (assumeHandWeapon) {
    const persistentHandWeapon = rows.find((row) => isHandWeapon(row.sourceName || row.name) && !row.requiresSelection)
    if (persistentHandWeapon) {
      persistentHandWeapon.default = true
      persistentHandWeapon.locked = true
      persistentHandWeapon.alwaysIncluded = true
      persistentHandWeapon.exclusiveGroup = undefined
    } else {
      let id = 'hand-weapon'
      let index = 2
      while (seen.has(id)) id = `hand-weapon-${index++}`
      rows.unshift({ id, name: displayText({ name_en: 'Hand weapon' }) || 'Hand weapon', sourceName: 'Hand weapon', kind: 'melee', range: 'Combat', strength: 'S', ap: '—', rules: [], points: 0, default: true, locked: true, alwaysIncluded: true, selectionMode: 'unit-toggle', costMode: 'flat', path: '/weapons-of-war/hand-weapon' })
    }
  }
  return rows
}

function magicOptionNote(item: RawBuilderItem) {
  const magic = item?.magic
  if (!magic) return ''
  if (typeof magic === 'number') return `Magic allowance: up to ${magic} pts`
  if (!isRecord(magic)) return ''
  const max = Number(magic.maxPoints || magic.maximum || magic.points || 0)
  const types = (Array.isArray(magic.types) ? magic.types : []).map((value: unknown) => String(value).replace(/-/g, ' ')).filter(Boolean)
  const detail = [types.length ? types.join(', ') : '', max > 0 ? `up to ${max} pts` : ''].filter(Boolean).join(' · ')
  return detail ? `Magic allowance: ${detail}` : 'Magic allowance'
}

function magicAllowanceFromValue(value: unknown) {
  if (!value) return undefined
  if (typeof value === 'number') return { maxPoints: Number(value), types: ['weapon', 'armor', 'talisman', 'enchanted-item'] } as PrototypeUnit['magicAllowance']
  if (!isRecord(value)) return undefined
  const allowed = (Array.isArray(value.types) ? value.types : []).filter((type): type is string => typeof type === 'string' && ['weapon', 'armor', 'talisman', 'enchanted-item', 'arcane-item', 'banner'].includes(type))
  if (!allowed.length) return undefined
  return { maxPoints: Number(value.maxPoints || value.maximum || value.points || 0), types: allowed } as PrototypeUnit['magicAllowance']
}

function rosterOptionRequirements(value: unknown) {
  const note = noteText(value).replace(/\s+/g, ' ').trim()
  const requiresRosterGeneral: string[] = []
  const requiresRosterUnit: string[] = []
  const add = (rows: string[], name: string) => {
    const clean = name.replace(/^(?:a|an|the)\s+/i, '').replace(/\s+(?:model|unit)$/i, '').trim()
    if (clean && !rows.some((row) => row.toLowerCase() === clean.toLowerCase())) rows.push(clean)
  }
  for (const match of note.matchAll(/(?:if|provided|only if)\s+(.+?)\s+is\s+(?:the\s+)?army[’']s\s+General\b/gi)) add(requiresRosterGeneral, match[1])
  for (const match of note.matchAll(/(?:if|provided|only if)\s+(.+?)\s+is\s+(?:your\s+)?General\b/gi)) add(requiresRosterGeneral, match[1])
  for (const match of note.matchAll(/(?:if|provided|only if)\s+(?:the\s+)?army\s+(?:includes|contains|has)\s+(.+?)(?=[.;]|$)/gi)) add(requiresRosterUnit, match[1])
  for (const match of note.matchAll(/(?:if|provided|only if)\s+(.+?)\s+is\s+(?:included|present)\s+in\s+(?:the|your)\s+army\b/gi)) add(requiresRosterUnit, match[1])
  for (const match of note.matchAll(/(?:may|can)\s+only\s+be\s+(?:taken|selected|chosen|used)\s+if\s+(.+?)\s+is\s+(?:included|present)\s+in\s+(?:the|your)\s+army\b/gi)) add(requiresRosterUnit, match[1])
  for (const match of note.matchAll(/(?:requires?|only available with)\s+(.+?)\s+(?:in|included in|present in)\s+(?:the|your)\s+army\b/gi)) add(requiresRosterUnit, match[1])
  for (const match of note.matchAll(/(?:if|provided|only if)\s+(?:the\s+)?army\s+(?:includes|contains|has)\s+(?:at least one\s+)?(.+?)(?=[.;]|$)/gi)) add(requiresRosterUnit, match[1])
  const maximumMatch = note.match(/\b0\s*[–-]\s*(\d+)\s+(?:unit|model|choice|selection)s?\b/i)
  return {
    requiresRosterGeneral: requiresRosterGeneral.length ? requiresRosterGeneral : undefined,
    requiresRosterUnit: requiresRosterUnit.length ? requiresRosterUnit : undefined,
    maximumPerRoster: maximumMatch ? Math.max(0, Number(maximumMatch[1]) || 0) : undefined,
  }
}

function equipmentOptions(raw: RawBuilderUnit, catalog: OwbRuleCatalog, compositionId: string): PrototypeEquipmentOption[] {
  const rows: PrototypeEquipmentOption[] = []
  const idCounts = new Map<string, number>()
  const uniqueId = (base: string) => {
    const count = (idCounts.get(base) || 0) + 1
    idCounts.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  }
  const add = (item: RawBuilderItem, kind: PrototypeEquipmentOption['kind'], prefix: string, extra: Partial<PrototypeEquipmentOption> = {}) => {
    if (!sourceAppliesToComposition(item, compositionId)) return null
    const sourceName = text(item)
    if (!sourceName) return null
    const name = displayText(item) || sourceName
    const requestedId = extra.id || String(item.id || `${prefix}-${slug(sourceName)}`)
    const notes = [localizedSourceText(item.notes) || noteText(item.notes), magicOptionNote(item)].filter(Boolean).join(' • ')
    const row: PrototypeEquipmentOption = {
      id: uniqueId(requestedId),
      name,
      sourceName,
      points: Number(item.points || 0),
      default: extra.default ?? sourceIncluded(item),
      costMode: Boolean(item.perModel) ? 'per-model' : 'flat',
      selectionMode: Boolean(item.stackable) && kind !== 'armour' && !/\b(?:armour|armor|shield)\b/i.test(sourceName) && !unitWidePerModelRule(sourceName) ? 'per-model-count' : 'unit-toggle',
      allocationGroup: Boolean(item.stackable) && kind !== 'armour' && !/\b(?:armour|armor|shield)\b/i.test(sourceName) && !unitWidePerModelRule(sourceName) ? String(item.allocationGroup || item.group || `${prefix}-${slug(sourceName)}`) : undefined,
      perModel: Boolean(item.perModel),
      stackable: Boolean(item.stackable) && kind !== 'armour' && !/\b(?:armour|armor|shield)\b/i.test(sourceName) && !unitWidePerModelRule(sourceName),
      minimum: Number(item.minimum || 0) > 0 ? Number(item.minimum) : undefined,
      maximum: Number(item.maximum || 0) > 0 ? Number(item.maximum) : undefined,
      rawId: item.id ? String(item.id) : undefined,
      // Any source-default choice is included by default in Old.dex and therefore locked.
      // Every non-default choice remains unlocked.
      locked: sourceIncluded(item),
      alwaysIncluded: sourceAlwaysIncluded(item),
      kind,
      note: notes,
      exclusiveGroup: item.exclusive ? `${extra.requiresSelection || prefix}-exclusive` : undefined,
      magicAllowance: magicAllowanceFromValue(item.magic),
      referencePath: resolveOwbRuleFromCatalog(catalog, sourceName)?.path,
      ...rosterOptionRequirements(item.notes),
      ...extra,
    }
    // Source data already enforces mutually exclusive choices. Hide explanatory
    // notes that merely repeat that enforced constraint (for example,
    // “Must choose Lore of Yang or Lore of Yin”) without changing the source
    // default/locked state of the selected option.
    if (row.exclusiveGroup && /^must choose\b.*\bor\b/i.test(String(row.note || '').trim())) row.note = ''
    const ward = `${sourceName} ${noteText(item.notes)}`.match(/(?:Ward\s+save(?:\s+of)?\s*\(?\s*(2\+|3\+|4\+|5\+|6\+)\s*\)?|(2\+|3\+|4\+|5\+|6\+)\s+Ward\s+save)/i)
    if (ward) row.profileOverride = { ...(row.profileOverride || {}), Ward: ward[1] || ward[2] }
    rows.push(row)
    return row
  }
  const addChildren = (items: RawBuilderItem[], parentId: string, prefix: string, inheritedKind: PrototypeEquipmentOption['kind'] = 'special') => {
    for (const child of items) {
      if (!sourceAppliesToComposition(child, compositionId)) continue
      const childName = text(child)
      if (!childName) continue
      const childDescriptor = splitWeaponDescriptor(childName, catalog)
      if (childDescriptor.weaponParts.length && !childDescriptor.nonWeaponParts.length) continue
      const optionName = childDescriptor.nonWeaponParts.length ? childDescriptor.nonWeaponParts.join(', ') : childName
      const kind: PrototypeEquipmentOption['kind'] = /shield|armour|armor/i.test(optionName) ? 'equipment' : inheritedKind
      const childRow = add({ ...child, name_en: optionName }, kind, prefix, { requiresSelection: parentId, ...(childDescriptor.nonWeaponParts.length && childDescriptor.weaponParts.length ? { id: selectableId(child, prefix), addsProfile: optionName, profileEquipment: childDescriptor.weaponParts } : {}), ...( /shield/i.test(optionName) ? { saveModifier: 1 } : {} ) })
      if (childRow && Array.isArray(child.options)) addChildren(child.options, childRow.id, `${prefix}-option`, kind === 'mount-option' ? 'mount-option' : 'special')
    }
  }

  for (const item of Array.isArray(raw.command) ? raw.command : []) {
    const row = add(item, 'role', 'command')
    if (row && Array.isArray(item.options)) addChildren(item.options, row.id, `${row.id}-option`)
  }
  for (const item of Array.isArray(raw.armor) ? raw.armor : []) {
    const itemName = text(item)
    const frenzy = /^Frenzy(?:\s*\([^)]*\))?$/i.test(itemName.trim())
    const save = frenzy ? undefined : armourSaveFromName(itemName)
    const row = add(item, frenzy ? 'special' : 'armour', frenzy ? 'special' : 'armour', {
      ...(save ? { profileOverride: { Sv: save } } : {}),
      default: sourceIncluded(item),
      ...(frenzy ? {} : { exclusiveGroup: 'unit-armour-choice' }),
    })
    if (row && Array.isArray(item.options)) addChildren(item.options, row.id, `${row.id}-option`, frenzy ? 'special' : 'special')
  }
  for (const item of Array.isArray(raw.options) ? raw.options : []) {
    const name = text(item)
    if (!name) continue
    const descriptor = splitWeaponDescriptor(name, catalog)
    if (descriptor.weaponParts.length && !descriptor.nonWeaponParts.length) continue
    const optionName = descriptor.nonWeaponParts.length ? descriptor.nonWeaponParts.join(', ') : name
    const mixedProfile = descriptor.weaponParts.length && descriptor.nonWeaponParts.length
    const row = add({ ...item, name_en: optionName }, /shield/i.test(optionName) ? 'equipment' : 'special', 'option', {
      ...(mixedProfile ? { id: selectableId(item, 'option'), addsProfile: optionName, profileEquipment: descriptor.weaponParts } : {}),
      ...(/shield/i.test(optionName) ? { saveModifier: 1 } : (/warpaint/i.test(optionName) ? { profileOverride: { Ward: '6+' } } : {})),
    })
    if (row && Array.isArray(item.options)) addChildren(item.options, row.id, `${row.id}-option`)
  }
  const mounts = Array.isArray(raw.mounts) ? raw.mounts : []
  for (const item of mounts) {
    const mountId = `mount-${slug(text(item))}`
    const row = add(item, 'mount', 'mount', { id: mountId, exclusiveGroup: 'mount', default: sourceIncluded(item) })
    if (row && Array.isArray(item.options)) addChildren(item.options, row.id, `${mountId}-option`, 'mount-option')
  }

  // Wizard levels are normalized as one exclusive state. Only the model's
  // source-included starting level is checked/locked; every higher level remains
  // an ordinary unchecked, unlocked upgrade.
  const startingWizardLevel = sourceWizardStartingLevel(raw)
  const wizardLevel = (value: string) => wizardLevelValue(value)
  const wizardParents = rows.filter((option) => /^Wizard$/i.test((option.sourceName || option.name).trim()))
  wizardParents.forEach((parent) => {
    const levels = rows.filter((option) => option.requiresSelection === parent.id && wizardLevel(option.sourceName || option.name) > 0).sort((a, b) => wizardLevel(a.sourceName || a.name) - wizardLevel(b.sourceName || b.name))
    if (!levels.length) return
    const sourceLevel = levels.find((option) => option.default || option.locked)
    const parentIncluded = Boolean(parent.default || parent.locked || sourceLevel || (wizardParents.length === 1 && startingWizardLevel > 0))
    parent.default = parentIncluded
    parent.locked = parentIncluded
    const includedLevel = parentIncluded ? (sourceLevel || levels.find((option) => wizardLevel(option.sourceName || option.name) === startingWizardLevel) || levels[0]) : undefined
    levels.forEach((option) => {
      option.exclusiveGroup = `${parent.id}-wizard-level`
      const included = Boolean(includedLevel && option.id === includedLevel.id)
      option.default = included
      option.locked = included
      option.alwaysIncluded = false
    })
  })
  const hasWizardParent = rows.some((option) => /^Wizard$/i.test((option.sourceName || option.name).trim()))
  if (!hasWizardParent) {
    const directLevels = rows.filter((option) => wizardLevel(option.sourceName || option.name) > 0).sort((a, b) => wizardLevel(a.sourceName || a.name) - wizardLevel(b.sourceName || b.name))
    if (directLevels.length) {
      const includedLevel = directLevels.find((option) => wizardLevel(option.sourceName || option.name) === startingWizardLevel) || (startingWizardLevel > 0 ? directLevels[0] : undefined)
      directLevels.forEach((option) => {
        option.exclusiveGroup = 'wizard-level'
        const included = Boolean(includedLevel && option.id === includedLevel.id)
        option.default = included
        option.locked = included
        option.alwaysIncluded = false
      })
    }
  }
  const inferred = inferEquipmentOptionDependencies(rows.map((row) => ({ ...row, name: row.sourceName || row.name })), sourceRuleText(raw, catalog))
  return inferred.map((row, index) => ({ ...row, name: rows[index]?.name || row.name, sourceName: rows[index]?.sourceName || row.sourceName }))
}


function selectedSpecialRules(raw: RawBuilderUnit, options: PrototypeEquipmentOption[], catalog: OwbRuleCatalog, compositionId: string) {
  const rules: PrototypeUnit['specialRules'] = []
  const used = new Set<string>()
  const matchingOption = (name: string, kind?: PrototypeEquipmentOption['kind'], parentId?: string) => {
    const row = options.find((option) => !used.has(option.id) && (option.sourceName || option.name) === name && (!kind || option.kind === kind) && (!parentId || option.requiresSelection === parentId))
    if (row) used.add(row.id)
    return row
  }
  const push = (value: unknown, selectionId: string) => {
    const names = splitOwbSourceList(text(value), catalog)
    const displayNames = splitOwbSourceList(localizedSourceText(value) || text(value))
    names.forEach((sourceName, index) => {
      if (/^(?:Level\s*\d+\s*Wizard|Wizard\s*Level\s*\d+|(?:The\s+)?Lore\s+of\b)/i.test(sourceName)) return
      const name = displayNames[index] || sourceName
      const tone = specialRuleTone(sourceName)
      const resolved = resolveOwbRuleFromCatalog(catalog, sourceName)
      rules.push({ name, sourceName, path: resolved?.path || '', timing: phaseLabel(tone), tone, summary: '', keywords: [], requiresSelection: selectionId })
    })
  }
  const walk = (items: RawBuilderItem[], parentId?: string, kind?: PrototypeEquipmentOption['kind']) => {
    for (const item of items) {
      if (!sourceAppliesToComposition(item, compositionId)) continue
      const name = text(item)
      if (!name) continue
      let option: PrototypeEquipmentOption | undefined
      if (!weaponLike(name)) option = matchingOption(name, kind, parentId) || matchingOption(name, undefined, parentId)
      const itemRules = sourceRuleValue(item)
      if (option && itemRules) push(itemRules, option.id)
      if (option && /^Big [’']Uns$/i.test(name)) {
        const tone = specialRuleTone(name)
        rules.push({ name: displayText(item) || name, sourceName: name, path: '/special-rules/big-uns', timing: phaseLabel(tone), tone, summary: '', keywords: [], requiresSelection: option.id })
      }
      if (Array.isArray(item.options)) walk(item.options, option?.id || parentId, kind === 'mount' || kind === 'mount-option' ? 'mount-option' : undefined)
    }
  }
  walk(Array.isArray(raw.command) ? raw.command : [], undefined, 'role')
  walk(Array.isArray(raw.armor) ? raw.armor : [], undefined, 'armour')
  walk(Array.isArray(raw.options) ? raw.options : [])
  walk(Array.isArray(raw.mounts) ? raw.mounts : [], undefined, 'mount')
  return rules
}

function magicAllowance(raw: RawBuilderUnit, compositionId: string) {
  const item = (Array.isArray(raw.items) ? raw.items : []).find((candidate: RawBuilderItem) => sourceAppliesToComposition(candidate, compositionId) && /magic items/i.test(text(candidate)))
  return item ? magicAllowanceFromValue({ types: item.types, maxPoints: item.maxPoints }) : undefined
}

function spellLikeSpecialRules(raw: RawBuilderUnit) {
  const rules: PrototypeUnit['specialRules'] = []
  const seen = new Set<string>()
  const push = (value: unknown, kind: 'Spell' | 'Prayer' | 'Bound Spell') => {
    const rows = Array.isArray(value) ? value : []
    for (const rawEntry of rows) {
      const entry = isRecord(rawEntry) ? rawEntry : null
      const sourceName = entry ? text(entry) : String(rawEntry || '').trim()
      const name = entry ? (displayText(entry) || sourceName) : sourceName
      if (!sourceName) continue
      const key = sourceName.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const summary = entry ? noteText(entry.text_en || entry.text || entry.notes || entry.effect || entry.description) : ''
      const path = entry && typeof entry.path === 'string' && entry.path.startsWith('/') ? entry.path : '/magic/casting-spells'
      rules.push({ name, sourceName, path, timing: kind, tone: 'magic', summary, keywords: [{ label: kind, path: '/magic/casting-spells' }] })
    }
  }
  push(raw.spells, 'Spell')
  push(raw.prayers, 'Prayer')
  push(raw.boundSpells, 'Bound Spell')
  return rules
}

function baseSpecialRules(raw: RawBuilderUnit, catalog: OwbRuleCatalog, compositionId: string) {
  // Wizard level and available-lore metadata are profile configuration, not
  // standalone special rules. The current Wizard level is rendered from the
  // selected option state in UnitView instead.
  const compositionRules = compositionRecord(raw, compositionId)?.specialRules
  const ruleSource = compositionRules ?? sourceRuleValue(raw)
  const names = splitOwbSourceList(text(ruleSource), catalog).filter((name) => !/^(?:Level\s*\d+\s*Wizard|Wizard\s*Level\s*\d+|(?:The\s+)?Lore\s+of\b)/i.test(name))
  const localizedRuleSource = localizedSourceText(ruleSource) || text(ruleSource)
  const displayNames = names.length === 1 ? [localizedRuleSource || names[0]] : splitOwbSourceList(localizedRuleSource)
  return names.map((sourceName, index) => {
    const tone = specialRuleTone(sourceName)
    return {
      name: displayNames[index] || sourceName,
      sourceName,
      path: resolveOwbRuleFromCatalog(catalog, sourceName)?.path || '',
      timing: phaseLabel(tone),
      tone,
      summary: '',
      keywords: [] as Array<{ label: string; path: string }>,
    }
  })
}


function displayScalar(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim()
  return ''
}

function listPublication(raw: RawBuilderUnit, armyName: string) {
  const explicit = displayScalar(raw.publication || raw.sourceBook || raw.sourcePublication || raw.book)
  if (explicit) return explicit
  const coreForces = new Set(['Dwarfen Mountain Holds', 'Empire of Man', 'High Elf Realms', 'Kingdom of Bretonnia', 'Wood Elf Realms'])
  const coreHordes = new Set(['Beastmen Brayherds', 'Orc & Goblin Tribes', 'Tomb Kings of Khemri', 'Warriors of Chaos'])
  if (coreForces.has(armyName)) return 'Forces of Fantasy'
  if (coreHordes.has(armyName)) return 'Ravening Hordes'
  if (armyName === 'Grand Cathay') return 'Arcane Journal: Grand Cathay'
  if (armyName === 'Renegade Crowns') return "Arcane Journal: The War of Settra's Fury"
  return `Legacy Army List: ${armyName}`
}

function additionalUnitDetails(raw: RawBuilderUnit) {
  const fields: Array<[string, string]> = [
    ['Regimental Unit', 'regimentalUnit'],
    ['Maximum Detachments', 'maxDetachments'],
    ['Arcane Familiar', 'arcaneFamiliar'],
    ['Named Character', 'named'],
  ]
  return fields.map(([label, key]) => ({ label, value: displayScalar(raw[key]) })).filter((row) => row.value && row.value !== 'No')
}


function noteAppliesToComposition(note: string, compositionId: string) {
  if (!note || !compositionId) return true
  const match = note.match(/\bin (?:an? )?(.+?) army\b/i)
  if (!match) return true
  return slug(match[1]) === slug(compositionId)
}

function namedGeneralRequirement(raw: RawBuilderUnit, compositionId: string) {
  if (!raw.named) return false
  const mustPattern = /\bmust (?:be|always be|serve as|be chosen as) (?:your|the|this army(?:'s)?) General\b/i
  const direct = noteText(raw.notes)
  if (mustPattern.test(direct) && noteAppliesToComposition(direct, compositionId)) return true
  for (const item of Array.isArray(raw.command) ? raw.command : []) {
    if (!/^General$/i.test(text(item).trim())) continue
    const requirement = noteText(item.notes)
    if (!mustPattern.test(requirement)) continue
    const scope = item.armyComposition
    if (typeof scope === 'string' && scope !== compositionId) continue
    if (Array.isArray(scope) && !scope.includes(compositionId)) continue
    if (!noteAppliesToComposition(requirement, compositionId)) continue
    return true
  }
  return false
}

function indexedProfileRows(catalog: OwbRuleCatalog, sourceName: string, displayName: string, dataKey: string, compositionId: string, unitId: string) {
  const resolved = resolveOwbRuleFromCatalog(catalog, sourceName)
  const entry = resolved?.entry
  const rows = canonicalOwbProfileRows(entry, displayName, {
    factionId: dataKey,
    compositionId,
    rosterUnitId: unitId,
    rulesPath: resolved?.path || '',
  })
  const primary = selectCanonicalPrimaryProfile(rows, [sourceName, displayName, unitId])
  return { entry, rows, primary }
}

function formatLoreName(value: string) {
  const words = String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').split(' ').filter(Boolean)
  return words.map((word, index) => {
    const lower = word.toLowerCase()
    if (index > 0 && ['of', 'the', 'and'].includes(lower)) return lower
    return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : ''
  }).join(' ')
}

function makeCatalogUnit(raw: RawBuilderUnit, category: BuilderCategory, armyName: string, dataKey: string, compositionId: string, catalog: OwbRuleCatalog): PrototypeUnit {
  const options = equipmentOptions(raw, catalog, compositionId)
  const weapons = equipmentRows(raw, catalog, compositionId)
  const sourceName = text(raw) || String(raw.id)
  const displayName = displayText(raw) || sourceName
  const indexed = indexedProfileRows(catalog, sourceName, displayName, dataKey, compositionId, String(raw.id))
  return {
    id: String(raw.id),
    name: displayName,
    sourceName,
    category,
    points: baseSelectionPoints(raw, compositionId),
    unitSize: compositionUnitSize(raw, compositionId),
    profile: indexed.primary?.profile || blankProfile(),
    profileIdentity: indexed.primary?.identity,
    profiles: indexed.rows.length ? indexed.rows : undefined,
    weapons,
    equipmentOptions: options,
    magicAllowance: magicAllowance(raw, compositionId),
    details: {
      troopType: text(raw.troopType || raw.troop_type || raw.unitType || raw.type) || String(indexed.entry?.troopType || ''),
      baseSize: '',
      publication: String(indexed.entry?.page || '') || listPublication(raw, armyName),
      army: armyName,
      unitCategory: category,
      notes: localizedSourceText(raw.notes) || noteText(raw.notes),
    },
    specialRules: [...baseSpecialRules(raw, catalog, compositionId), ...selectedSpecialRules(raw, options, catalog, compositionId), ...spellLikeSpecialRules(raw)],
    keywords: [],
    minimumModels: compositionModelBounds(raw, compositionId).minimum,
    maximumModels: compositionModelBounds(raw, compositionId).maximum,
    basePointsPerModel: compositionPointsPerModel(raw, compositionId),
    named: Boolean(raw.named),
    mustBeGeneral: namedGeneralRequirement(raw, compositionId),
    cannotBeGeneral: /\bcannot be (?:your|the) general\b/i.test(noteText(raw.notes)),
    compositionNotes: (() => { const entry = compositionRecord(raw, compositionId); return entry ? [localizedSourceText(entry.notes) || noteText(entry.notes)].filter(Boolean) : [] })(),
    lores: (() => {
      const entry = compositionRecord(raw, compositionId)
      const scopedLores = Array.isArray(entry?.lores) ? entry.lores : null
      const source = scopedLores || [
        ...(Array.isArray(raw.lores) ? raw.lores : []),
        ...(Array.isArray(raw.magicLores) ? raw.magicLores : []),
        ...(Array.isArray(raw.prayerLores) ? raw.prayerLores : []),
        ...(Array.isArray(raw.prayersLores) ? raw.prayersLores : []),
      ]
      return [...new Set(source.map((value: unknown) => formatLoreName(text(value))).filter(Boolean))]
    })(),
    baseWizardLevel: sourceWizardStartingLevel(raw) || undefined,
    additionalDetails: additionalUnitDetails(raw),
    mixedWeaponAllocation: weapons.some((weapon) => weapon.selectionMode === 'per-model-count'),
    assumesHandWeapon: !handWeaponExplicitlyExcluded(raw),
    sourceKind: 'live',
  } as PrototypeUnit
}


function compositionName(id: string) {
  const special: Record<string, string> = {
    'grand-army': 'Grand Army',
    'orc-and-goblin-tribes': 'Grand Army',
    'dwarfen-mountain-holds': 'Grand Army',
    'empire-of-man': 'Grand Army',
    'grand-cathay': 'Grand Army',
    'high-elf-realms': 'Grand Army',
    'kingdom-of-bretonnia': 'Grand Army',
    'lizardmen': 'Grand Army',
    'wood-elf-realms': 'Grand Army',
    'dark-elves': 'Grand Army',
    'beastmen-brayherds': 'Grand Army',
    'chaos-dwarfs': 'Grand Army',
    'daemons-of-chaos': 'Grand Army',
    'renegade-crowns': 'Grand Army',
    'skaven': 'Grand Army',
    'warriors-of-chaos': 'Grand Army',
    'tomb-kings-of-khemri': 'Grand Army',
    'vampire-counts': 'Grand Army',
    'ogre-kingdoms': 'Grand Army',
    'nomadic-waaagh': 'Nomadic Waaagh!',
  }
  if (special[id]) return special[id]
  if (/^[a-z]{2}-renegade$/.test(id)) return 'Renegade'
  return id.split('-').filter(Boolean).map((word) => word === 'of' || word === 'the' || word === 'and' ? word : word.charAt(0).toUpperCase() + word.slice(1)).join(' ').replace(/^./, (char) => char.toUpperCase())
}

export async function loadLiveArmyCompositions(dataKey: string, fallback: Array<{ id: string; name: string }> = []) {
  const data = await loadArmyData(dataKey) as ArmyDataDocument
  const ids = new Set<string>(fallback.map((row) => row.id))
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue
    for (const raw of value as RawBuilderUnit[]) {
      const composition = raw?.armyComposition
      if (typeof composition === 'string' && composition) ids.add(composition)
      else if (Array.isArray(composition)) composition.filter(Boolean).forEach((id) => ids.add(String(id)))
      else if (composition && typeof composition === 'object') Object.keys(composition).forEach((id) => ids.add(id))
    }
  }
  const known = new Map(fallback.map((row) => [row.id, row.name]))
  const rows = [...ids].map((id) => ({ id, name: known.get(id) || compositionName(id) }))
  const deduped = new Map<string, { id: string; name: string }>()
  for (const row of rows) {
    const key = row.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const existing = deduped.get(key)
    if (!existing || known.has(row.id) || row.id === dataKey) deduped.set(key, row)
  }
  return [...deduped.values()].sort((a, b) => {
    const aGrand = a.name === 'Grand Army' ? 0 : 1
    const bGrand = b.name === 'Grand Army' ? 0 : 1
    return aGrand - bGrand || a.name.localeCompare(b.name)
  })
}

export async function loadLiveArmyCatalog(dataKey: string, armyName: string, compositionId: string) {
  const [data, ruleCatalog] = await Promise.all([loadArmyData(dataKey) as Promise<ArmyDataDocument>, loadOwbRuleCatalog()])
  const rows: PrototypeUnit[] = []
  for (const [sourceKey, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue
    for (const raw of value as RawBuilderUnit[]) {
      if (!raw?.id || !raw?.name_en) continue
      const category = compositionCategory(raw, compositionId, sourceKey)
      if (!category) continue
      rows.push(makeCatalogUnit(raw, category, armyName, dataKey, compositionId, ruleCatalog))
    }
  }
  rows.push(...customUnitsForArmy(dataKey, compositionId))
  const seen = new Set<string>()
  return rows.filter((unit) => !seen.has(unit.id) && seen.add(unit.id)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

export async function loadRawBuilderUnit(dataKey: string, unitId: string): Promise<RawBuilderUnit | null> {
  const data = await loadArmyData(dataKey) as ArmyDataDocument
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue
    const found = (value as RawBuilderUnit[]).find((row) => String(row?.id) === unitId)
    if (found) return found
  }
  return null
}

type PreparedLiveUnitProfile = {
  raw: RawBuilderUnit
  category: BuilderCategory
  unit: PrototypeUnit
  data: ArmyDataDocument
}

function clonePrototypeUnit(unit: PrototypeUnit): PrototypeUnit {
  return {
    ...unit,
    profile: { ...unit.profile },
    profiles: unit.profiles?.map((row) => ({ ...row, identity: row.identity ? { ...row.identity } : undefined, profile: { ...row.profile } })),
    weapons: unit.weapons.map((weapon) => ({
      ...weapon,
      rules: [...(weapon.rules || [])],
      ruleLinks: weapon.ruleLinks?.map((link) => ({ ...link })),
    })),
    equipmentOptions: unit.equipmentOptions.map((option) => ({
      ...option,
      profileOverride: option.profileOverride ? { ...option.profileOverride } : undefined,
      riderProfileModifiers: option.riderProfileModifiers ? { ...option.riderProfileModifiers } : undefined,
      magicAllowance: option.magicAllowance ? { ...option.magicAllowance, types: [...option.magicAllowance.types] } : undefined,
      profileEquipment: option.profileEquipment ? [...option.profileEquipment] : undefined,
    })),
    magicAllowance: unit.magicAllowance ? { ...unit.magicAllowance, types: [...unit.magicAllowance.types] } : undefined,
    details: { ...unit.details },
    specialRules: unit.specialRules.map((rule) => ({
      ...rule,
      keywords: rule.keywords.map((keyword) => ({ ...keyword })),
    })),
    keywords: unit.keywords.map((keyword) => ({ ...keyword })),
    additionalDetails: unit.additionalDetails?.map((detail) => ({ ...detail })),
    optionalProfiles: unit.optionalProfiles?.map((profile) => ({
      ...profile,
      profile: { ...profile.profile },
      equipment: profile.equipment ? [...profile.equipment] : undefined,
    })),
    lores: unit.lores ? [...unit.lores] : undefined,
    compositionNotes: unit.compositionNotes ? [...unit.compositionNotes] : undefined,
  }
}

async function prepareLiveUnitProfile(dataKey: string, armyName: string, unitId: string, compositionId: string): Promise<PreparedLiveUnitProfile | null> {
  const [data, ruleCatalog] = await Promise.all([loadArmyData(dataKey) as Promise<ArmyDataDocument>, loadOwbRuleCatalog()])
  let raw: RawBuilderUnit | null = null
  let sourceKey = 'core'
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue
    const found = (value as RawBuilderUnit[]).find((row) => String(row?.id) === unitId)
    if (found) {
      raw = found
      sourceKey = key
      break
    }
  }
  if (!raw) return null
  const category = compositionCategory(raw, compositionId, sourceKey) || categoryMap[sourceKey] || 'Core'
  const unit = makeCatalogUnit(raw, category, armyName, dataKey, compositionId, ruleCatalog)
  return { raw, category, unit, data }
}

export async function loadBaseLiveUnitProfile(dataKey: string, armyName: string, unitId: string, compositionId: string): Promise<PrototypeUnit | null> {
  const custom = customUnitForArmy(dataKey, compositionId, unitId)
  if (custom) return clonePrototypeUnit(custom)
  const prepared = await prepareLiveUnitProfile(dataKey, armyName, unitId, compositionId)
  return prepared ? clonePrototypeUnit(prepared.unit) : null
}

export async function loadLiveUnitProfile(dataKey: string, armyName: string, unitId: string, compositionId: string): Promise<PrototypeUnit | null> {
  const custom = customUnitForArmy(dataKey, compositionId, unitId)
  if (custom) return clonePrototypeUnit(custom)
  const prepared = await prepareLiveUnitProfile(dataKey, armyName, unitId, compositionId)
  if (!prepared) return null
  const enriched = await enrichLiveUnitReference(clonePrototypeUnit(prepared.unit), prepared.raw, prepared.category, armyName, dataKey, compositionId, prepared.data)
  return clonePrototypeUnit(enriched)
}

export async function loadLiveUnitProfileProgressively(
  dataKey: string,
  armyName: string,
  unitId: string,
  compositionId: string,
  callbacks: { onBase?: (unit: PrototypeUnit) => void; onEnriched?: (unit: PrototypeUnit) => void } = {},
): Promise<PrototypeUnit | null> {
  const custom = customUnitForArmy(dataKey, compositionId, unitId)
  if (custom) {
    const resolved = clonePrototypeUnit(custom)
    callbacks.onBase?.(clonePrototypeUnit(resolved))
    callbacks.onEnriched?.(clonePrototypeUnit(resolved))
    return resolved
  }
  const prepared = await prepareLiveUnitProfile(dataKey, armyName, unitId, compositionId)
  if (!prepared) return null
  const baseUnit = clonePrototypeUnit(prepared.unit)
  callbacks.onBase?.(clonePrototypeUnit(baseUnit))
  const enriched = await enrichLiveUnitReference(clonePrototypeUnit(prepared.unit), prepared.raw, prepared.category, armyName, dataKey, compositionId, prepared.data)
  const finalUnit = clonePrototypeUnit(enriched)
  callbacks.onEnriched?.(clonePrototypeUnit(finalUnit))
  return finalUnit
}
