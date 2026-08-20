import type { BuilderCategory } from '../data/builderPrototype'
import type { CompositionRuleCatalog, CompositionSelectionRequirement, CompositionUnitRule } from '../domain/composition'
import type { BuilderRosterSelection } from './builderRoster'
import { wizardLevelsFromLabels } from '../domain/wizard'
import { magicItemPointLimit, magicItemLimitLabel } from '../domain/magicItems'

export type RosterValidationIssue = {
  severity: 'error' | 'warning'
  section: BuilderCategory | 'Army'
  message: string
  instanceId?: string
}

const categoryLabel: Record<string, BuilderCategory> = {
  characters: 'Characters', core: 'Core', special: 'Special', rare: 'Rare', mercenaries: 'Mercenaries', allies: 'Allies', 'custom-units': 'Custom Units',
}

function slug(value: string) { return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
function hasOption(row: BuilderRosterSelection, pattern: RegExp) { return (row.options || []).some((name) => pattern.test(name)) }
function isCharacterRow(row: BuilderRosterSelection) { return row.category === 'General' || row.category === 'Characters' }
function rowsByType(roster: BuilderRosterSelection[], type?: string) {
  if (!type || type === 'all') return roster.filter((row) => isCharacterRow(row) || ['Core', 'Special', 'Rare'].includes(row.category))
  if (type === 'characters') return roster.filter(isCharacterRow)
  const label = categoryLabel[type]
  return label ? roster.filter((row) => row.category === label) : []
}
function scaled(rule: CompositionUnitRule, key: 'min' | 'max', points: number) {
  const value = Number(rule[key])
  if (!Number.isFinite(value)) return undefined
  return rule.points ? Math.floor(points / Number(rule.points)) * value : value
}
function namesForIds(ids: string[] = []) { return ids.map((id) => id.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')).join(' / ') }

function selectionRequirement(value: CompositionSelectionRequirement | string | string[] | undefined) {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return { unit: String(value.unit || ''), id: String(value.id || '') }
  const id = Array.isArray(value) ? String(value[0] || '') : String(value)
  return { unit: '', id }
}
function rowHasSelection(row: BuilderRosterSelection, id: string) {
  const wanted = slug(id)
  if (!wanted) return false
  if (wanted === 'general' && row.category === 'General') return true
  const ids = [...(row.weaponIds || []), ...(row.equipmentIds || [])].map((entry) => slug(entry))
  if (ids.some((entry) => entry === wanted || entry.endsWith(`-${wanted}`))) return true
  return (row.options || []).some((name) => {
    const current = slug(name)
    return current === wanted || current.endsWith(`-${wanted}`) || wanted.endsWith(`-${current}`)
  })
}
function requirementRows(roster: BuilderRosterSelection[], requirement: { unit: string; id: string }, fallback: BuilderRosterSelection[]) {
  if (!requirement.unit) return fallback
  return roster.filter((row) => row.unitId.split('.')[0] === requirement.unit)
}

function wizardLevels(row: BuilderRosterSelection) { return wizardLevelsFromLabels(row.options || []) }
function highestWizardLevel(row: BuilderRosterSelection) {
  const levels = wizardLevels(row)
  if (/settra the imperishable/i.test(row.name)) return 6
  if (/tomb (?:king|prince)/i.test(row.name) && hasOption(row, /Arise!.*Level 1 Wizard/i)) return 6
  return levels.length ? Math.max(...levels) : 0
}
function markCounts(rows: BuilderRosterSelection[]) {
  const marks = ['Mark of Khorne', 'Mark of Nurgle', 'Mark of Slaanesh', 'Mark of Tzeentch']
  const result = new Map<string, number>()
  for (const row of rows) for (const mark of marks) if (hasOption(row, new RegExp(`^${mark}$`, 'i'))) result.set(mark, (result.get(mark) || 0) + 1)
  return result
}

function validateLimitOneMagic(roster: BuilderRosterSelection[], issues: RosterValidationIssue[]) {
  const counts = new Map<string, { label: string; count: number }>()
  const labels: Record<string, string> = {
    weapon: 'Magic Weapon', armor: 'Magic Armour', talisman: 'Talisman',
    'enchanted-item': 'Enchanted Item', 'arcane-item': 'Arcane Item', banner: 'Magic Banner',
  }
  for (const row of roster) for (const item of row.magicItems || []) {
    const key = item.type
    const current = counts.get(key) || { label: labels[key] || key, count: 0 }
    current.count += Math.max(1, Number(item.count || 1))
    counts.set(key, current)
  }
  for (const entry of counts.values()) if (entry.count > 1) issues.push({ severity: 'error', section: 'Army', message: `Magical Category - Limit 1 allows only one ${entry.label} across the entire roster.` })
}

function validateUniqueMagicItems(roster: BuilderRosterSelection[], issues: RosterValidationIssue[]) {
  const seen = new Map<string, { name: string; count: number }>()
  for (const row of roster) for (const item of row.magicItems || []) {
    if (!item.onePerArmy) continue
    const key = slug(item.slug || item.name)
    const current = seen.get(key) || { name: item.name, count: 0 }
    current.count += Math.max(1, Number(item.count || 1))
    seen.set(key, current)
  }
  seen.forEach((entry) => { if (entry.count > 1) issues.push({ severity: 'error', section: 'Army', message: `${entry.name} may only be selected once per army.` }) })
}

export function validateRoster(input: {
  roster: BuilderRosterSelection[]
  points: number
  armySlug: string
  compositionId: string
  compositionRuleId: string
  ruleCatalog?: CompositionRuleCatalog | null
  compositionOptionIds?: string[]
}) {
  const { roster, points, armySlug, compositionId, compositionRuleId, ruleCatalog, compositionOptionIds = [] } = input
  const issues: RosterValidationIssue[] = []
  const generals = roster.filter((row) => row.category === 'General' || hasOption(row, /^General$/i))
  const forcedGenerals = roster.filter((row) => row.mustBeGeneral)
  if (generals.length < 1) issues.push({ severity: 'error', section: 'General', message: 'The army must include exactly one General.' })
  else if (generals.length > 1) generals.forEach((row) => issues.push({ severity: 'error', section: 'General', instanceId: row.instanceId, message: 'The army may include only one General.' }))
  if (forcedGenerals.length > 1) forcedGenerals.forEach((row) => issues.push({ severity: 'error', section: 'General', instanceId: row.instanceId, message: `${row.name} must be the General, but more than one such named character is present.` }))
  else if (forcedGenerals.length === 1 && !generals.some((row) => row.instanceId === forcedGenerals[0].instanceId)) issues.push({ severity: 'error', section: 'General', instanceId: forcedGenerals[0].instanceId, message: `${forcedGenerals[0].name} must be the General.` })
  generals.filter((row) => row.cannotBeGeneral).forEach((row) => issues.push({ severity: 'error', section: 'General', instanceId: row.instanceId, message: `${row.name} cannot be the General.` }))
  const bsbs = roster.filter((row) => hasOption(row, /Battle Standard Bearer/i))
  if (bsbs.length > 1) bsbs.forEach((row) => issues.push({ severity: 'error', section: 'Characters', instanceId: row.instanceId, message: 'The army may include at most one Battle Standard Bearer.' }))
  if (generals.length === 1 && !generals[0].mustBeGeneral && Number.isFinite(generals[0].leadership)) {
    const eligibleLeadership = roster
      .filter((row) => isCharacterRow(row) && row.generalEligible && Number.isFinite(row.leadership))
      .map((row) => Number(row.leadership))
    if (eligibleLeadership.length && Number(generals[0].leadership || 0) < Math.max(...eligibleLeadership)) issues.push({ severity: 'error', section: 'Characters', instanceId: generals[0].instanceId, message: 'The General must be selected from an eligible character with the highest Leadership.' })
  }

  validateUniqueMagicItems(roster, issues)
  const optionSet = new Set(compositionOptionIds)
  if (optionSet.has('limit-one-magic')) validateLimitOneMagic(roster, issues)
  const magicCap = magicItemPointLimit(optionSet)
  if (Number.isFinite(magicCap)) {
    const label = magicItemLimitLabel(magicCap)
    roster.forEach((row) => (row.magicItems || []).filter((item) => item.points > magicCap).forEach((item) => issues.push({ severity: 'error', section: row.category, instanceId: row.instanceId, message: `${item.name} is not allowed when Magic Items are limited to ${label}.` })))
  }

  const composition = ruleCatalog?.[compositionId] || ruleCatalog?.['grand-army']
  const alliesAllowed = optionSet.has('allow-allies') && Boolean(composition?.allies)
  const mercenariesAllowed = optionSet.has('allow-mercenaries') && Boolean(composition?.mercenaries)
  roster.filter((row) => row.category === 'Allies' && !alliesAllowed).forEach((row) => issues.push({ severity: 'error', section: 'Allies', instanceId: row.instanceId, message: `${row.name} is an Ally, but Allies are not enabled for this list.` }))
  roster.filter((row) => row.category === 'Mercenaries' && !mercenariesAllowed).forEach((row) => issues.push({ severity: 'error', section: 'Mercenaries', instanceId: row.instanceId, message: `${row.name} is a Mercenary, but Mercenaries are not enabled for this list.` }))
  roster.filter((row) => row.category === 'Custom Units' && !optionSet.has('allow-custom-units')).forEach((row) => issues.push({ severity: 'error', section: 'Custom Units', instanceId: row.instanceId, message: `${row.name} is a custom unit, but Custom Units are not enabled for this list.` }))

  const monsterMashRows = roster.filter((row) => row.category === 'Core' && /(?:Monstrous Creature|War Machine|Chariot)/i.test(String(row.troopType || '')))
  if (!optionSet.has('monster-mash')) monsterMashRows.forEach((row) => issues.push({ severity: 'error', section: 'Core', instanceId: row.instanceId, message: `${row.name} requires the Monster Mash Battle Composition option to count as Core.` }))
  else if (monsterMashRows.length > 1) monsterMashRows.forEach((row) => issues.push({ severity: 'error', section: 'Core', instanceId: row.instanceId, message: 'Monster Mash allows only one non-character Monstrous Creature, War Machine or Chariot to count as Core.' }))

  const nonCharacters = roster.filter((row) => !isCharacterRow(row) && !/\b(?:WM|WB|Sw)\b|war machine|war beast|swarm/i.test(row.troopType || ''))
  const minimumNonCharacters = compositionRuleId.includes('battle-march') ? 2 : 3
  if (nonCharacters.length < minimumNonCharacters) issues.push({ severity: 'error', section: 'Army', message: `The army needs at least ${minimumNonCharacters} qualifying non-character units.` })

  if (compositionRuleId.includes('grand-melee')) {
    const maxSingle = points * .25
    roster.filter((row) => !row.named && row.totalPoints > maxSingle).forEach((row) => issues.push({ severity: 'error', section: row.category, instanceId: row.instanceId, message: `${row.name} exceeds the Grand Melee 25% single-unit limit (${Math.floor(maxSingle)} pts).` }))
    const totalModels = roster.reduce((sum, row) => sum + Math.max(1, Number(row.modelCount || 1)), 0)
    if (totalModels > 0) roster.filter((row) => Math.max(1, Number(row.modelCount || 1)) > totalModels / 2).forEach((row) => issues.push({ severity: 'error', section: row.category, instanceId: row.instanceId, message: `${row.name} contains more than half of the models in the army.` }))
    const level3Max = Math.floor(points / 1000)
    const level4Max = Math.floor(points / 2000)
    let level3 = 0; let level4 = 0
    roster.filter((row) => !row.named).forEach((row) => wizardLevels(row).forEach((level) => { if (level === 3) level3 += 1; if (level === 4) level4 += 1 }))
    if (level3 > level3Max) issues.push({ severity: 'error', section: 'Characters', message: `Grand Melee allows at most ${level3Max} Level 3 Wizard${level3Max === 1 ? '' : 's'} at ${points} points.` })
    if (level4 > level4Max) issues.push({ severity: 'error', section: 'Characters', message: `Grand Melee allows at most ${level4Max} Level 4 Wizard${level4Max === 1 ? '' : 's'} at ${points} points.` })
  }

  if (compositionRuleId.includes('combined-arms')) {
    const extra = Math.max(Math.floor((points - 2000) / 1000), 0)
    const limits: Partial<Record<BuilderCategory, number>> = { Characters: 3 + extra, Core: 4 + extra, Special: 3 + extra, Rare: 2 + extra, Mercenaries: 2 + extra }
    for (const [category, max] of Object.entries(limits) as Array<[BuilderCategory, number]>) {
      const counts = new Map<string, number>()
      const rows = category === 'Characters' ? roster.filter(isCharacterRow) : roster.filter((row) => row.category === category)
      rows.forEach((row) => counts.set(row.unitId, (counts.get(row.unitId) || 0) + 1))
      counts.forEach((count, id) => { if (count > max) issues.push({ severity: 'error', section: category, message: `${namesForIds([id])} exceeds the Combined Arms duplicate limit of ${max}.` }) })
    }
  }

  if (compositionRuleId.includes('battle-march')) {
    const perUnitMax: Partial<Record<BuilderCategory, number>> = { Characters: .25, Core: .35, Special: .30, Rare: .25, Mercenaries: .25 }
    for (const row of roster) {
      const fraction = perUnitMax[row.category === 'General' ? 'Characters' : row.category]
      if (fraction && row.totalPoints > points * fraction) issues.push({ severity: 'error', section: row.category, instanceId: row.instanceId, message: `${row.name} exceeds the Battle March ${Math.round(fraction * 100)}% single-unit limit.` })
    }
  }

  const battleMarchZeroXInstances = new Set<string>()
  if (composition) {
    for (const [rawCategory, rules] of Object.entries(composition)) {
      const label = categoryLabel[rawCategory]
      if (!label || !rules || typeof rules !== 'object') continue
      const categoryRows = label === 'Characters' ? roster.filter(isCharacterRow) : roster.filter((row) => row.category === label)
      const categoryPoints = categoryRows.reduce((sum, row) => sum + row.totalPoints, 0)
      if (typeof rules.minPercent === 'number') {
        const required = points * rules.minPercent / 100
        if (categoryPoints < required) issues.push({ severity: 'error', section: label, message: `${label} must contain at least ${rules.minPercent}% of the army (${Math.ceil(required)} pts).` })
      }
      if (typeof rules.maxPercent === 'number') {
        const maximum = points * rules.maxPercent / 100
        if (categoryPoints > maximum) issues.push({ severity: 'error', section: label, message: `${label} may contain at most ${rules.maxPercent}% of the army (${Math.floor(maximum)} pts).` })
      }
      for (const unitRule of rules.units || []) {
        const targetRows = unitRule.requiredByType === 'all' ? roster.filter((row) => unitRule.ids?.includes(row.unitId.split('.')[0])) : categoryRows.filter((row) => unitRule.ids?.includes(row.unitId.split('.')[0]))
        const min = scaled(unitRule, 'min', points)
        const max = scaled(unitRule, 'max', points)
        const targetNames = namesForIds(unitRule.ids)
        if (compositionRuleId.includes('battle-march') && Number(unitRule.points) === 1000 && Number(unitRule.max || 0) > 0 && max === 0) targetRows.forEach((row) => battleMarchZeroXInstances.add(row.instanceId))
        if (!unitRule.requires || unitRule.requiresGeneral) {
          if (min !== undefined && targetRows.length < min) issues.push({ severity: 'error', section: label, message: `${targetNames}: minimum ${min} required.` })
          if (max !== undefined && targetRows.length > max && !(compositionRuleId.includes('battle-march') && unitRule.points)) targetRows.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${targetNames}: maximum ${max} allowed.` }))
        }
        if (unitRule.requiresGeneral && targetRows.length) {
          const requiredGeneral = generals.some((row) => unitRule.requires?.includes(row.unitId.split('.')[0]))
          if (!requiredGeneral) targetRows.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${targetNames} requires the General to be ${namesForIds(unitRule.requires)}.` }))
        }
        if (unitRule.requiresMounted) {
          targetRows.filter((row) => !(row.options || []).some((option) => /mounted on|warhorse|boar|wolf|chariot|dragon|steed|pegasus|wyvern|griffon|griffin|manticore|eagle/i.test(option) && !/on foot/i.test(option))).forEach((row) => {
            issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${row.name} must be mounted in this composition.` })
          })
        }
        if (unitRule.requiresIfGeneral?.length && generals.some((row) => unitRule.ids?.includes(row.unitId.split('.')[0]))) {
          if (!roster.some((row) => unitRule.requiresIfGeneral?.includes(row.unitId.split('.')[0]))) generals.filter((row) => unitRule.ids?.includes(row.unitId.split('.')[0])).forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `If ${targetNames} is the General, include ${namesForIds(unitRule.requiresIfGeneral)}.` }))
        }
        if (!unitRule.requiresGeneral && unitRule.requires?.length && targetRows.length) {
          const requiredRows = rowsByType(roster, unitRule.requiresType).filter((row) => unitRule.requires?.includes(row.unitId.split('.')[0]))
          if (unitRule.perUnit && max !== undefined && targetRows.length > requiredRows.length * max) targetRows.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${targetNames} needs enough ${namesForIds(unitRule.requires)} entries to support it.` }))
          else if (unitRule.perUnit && max === undefined && min !== undefined && targetRows.length > requiredRows.length + min) targetRows.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${targetNames} needs enough ${namesForIds(unitRule.requires)} entries to support it.` }))
          else if (!unitRule.perUnit && requiredRows.length === 0) targetRows.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${targetNames} requires ${namesForIds(unitRule.requires)}.` }))
          if (!unitRule.perUnit && max !== undefined && targetRows.length > max && !(compositionRuleId.includes('battle-march') && unitRule.points)) targetRows.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${targetNames}: maximum ${max} allowed.` }))
        }
        const optionRequirement = selectionRequirement(unitRule.requiresOption)
        if (optionRequirement?.id && targetRows.length) {
          const relevant = requirementRows(unitRule.requiresGeneral ? generals : roster, optionRequirement, targetRows)
          const selected = relevant.some((row) => rowHasSelection(row, optionRequirement.id))
          if (relevant.length && !selected) relevant.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${optionRequirement.unit ? namesForIds([optionRequirement.unit]) : targetNames} must select ${namesForIds([optionRequirement.id])}.` }))
        }
        const commandRequirement = selectionRequirement(unitRule.requiresCommand)
        if (commandRequirement?.id && targetRows.length) {
          const relevant = requirementRows(unitRule.requiresGeneral ? generals : roster, commandRequirement, targetRows)
          const selected = relevant.some((row) => rowHasSelection(row, commandRequirement.id))
          if (relevant.length && !selected) relevant.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${commandRequirement.unit ? namesForIds([commandRequirement.unit]) : targetNames} must include ${namesForIds([commandRequirement.id])}.` }))
        }
        if (unitRule.requiresMagicItem && targetRows.length) {
          const requirement = String(unitRule.requiresMagicItem)
          const hasItem = generals.some((row) => (row.magicItems || []).some((item) => slug(item.name) === slug(requirement) || item.slug === slug(requirement)))
          if (!hasItem) generals.forEach((row) => issues.push({ severity: 'error', section: label, instanceId: row.instanceId, message: `${targetNames} requires the General to carry ${namesForIds([requirement])}.` }))
        }
      }
    }
  } else if (roster.length) {
    issues.push({ severity: 'warning', section: 'Army', message: 'Composition rule data could not be loaded; only general list checks are active.' })
  }
  if (compositionRuleId.includes('battle-march') && battleMarchZeroXInstances.size > 1) issues.push({ severity: 'error', section: 'Army', message: 'Battle March permits only one unit selected from 0–X per 1,000 points allowances.' })

  if (armySlug === 'tomb-kings-of-khemri') {
    const hierophants = roster.filter((row) => hasOption(row, /^The Hierophant$/i))
    if (hierophants.length !== 1) issues.push({ severity: 'error', section: 'Characters', message: 'Tomb Kings armies require exactly one Hierophant.' })
    if (hierophants.length === 1) {
      const selectedLevel = highestWizardLevel(hierophants[0])
      const highestEligibleLevel = Math.max(0, ...roster.filter((row) => isCharacterRow(row) && (row.hierophantEligible || hasOption(row, /^The Hierophant$/i))).map(highestWizardLevel))
      if (selectedLevel && highestEligibleLevel && selectedLevel < highestEligibleLevel) issues.push({ severity: 'error', section: 'Characters', instanceId: hierophants[0].instanceId, message: 'The Hierophant must be chosen from the highest-level eligible Wizards in the army.' })
    }
    if (compositionId === 'mortuary-cults' && generals.length === 1 && hierophants.length === 1 && generals[0].instanceId !== hierophants[0].instanceId) { issues.push({ severity: 'error', section: 'Characters', instanceId: generals[0].instanceId, message: 'In a Mortuary Cults army, the Hierophant must also be the General.' }); issues.push({ severity: 'error', section: 'Characters', instanceId: hierophants[0].instanceId, message: 'In a Mortuary Cults army, the Hierophant must also be the General.' }) }
  }
  if (armySlug === 'warriors-of-chaos' && (compositionId === 'heralds-of-darkness' || compositionId === 'hordes-of-chaos')) {
    const characterMarks = markCounts(roster.filter(isCharacterRow))
    const unitMarks = markCounts(roster.filter((row) => !isCharacterRow(row)))
    const keys = new Set([...characterMarks.keys(), ...unitMarks.keys()])
    for (const mark of keys) {
      const characterCount = characterMarks.get(mark) || 0
      const unitCount = unitMarks.get(mark) || 0
      if (characterCount !== unitCount) issues.push({ severity: 'error', section: 'Army', message: `${mark}: The Shadow Grows requires the number selected for Characters (${characterCount}) to match the number selected for units (${unitCount}).` })
    }
  }
  if (armySlug === 'vampire-counts' && generals.length === 1 && highestWizardLevel(generals[0]) < 1) issues.push({ severity: 'error', section: 'Characters', instanceId: generals[0].instanceId, message: 'A Vampire Counts General must be a Wizard.' })

  return issues
}
