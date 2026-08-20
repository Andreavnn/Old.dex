import { armies } from './armies'
import { battleScenarioEntries, coreRuleEntrypoints, ruleSections, supportPages } from './rules'
import { armySourcePath, ruleIndexGroupPath, ruleReaderPath } from './ruleRepository'
import type { RuleIndexGroup } from '../services/ruleContent'
import { corePhaseSequences, coreRuleFlow } from './coreSequenceNavigation'

export type RuleBreadcrumb = {
  label: string
  to?: string
}

const coreSlugs = new Set([
  'the-strategy-phase',
  'the-movement-phase',
  'the-shooting-phase',
  'the-combat-phase',
  'special-rules',
  'magic',
  'weapons-of-war',
])

const scenarioNames = new Map(battleScenarioEntries.map((entry) => [entry.sourcePath, entry.name]))
const scenarioPaths = new Set(battleScenarioEntries.map((entry) => entry.sourcePath))

function prettyPathPart(value: string) {
  return decodeURIComponent(value)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function groupCrumb(label: string, group: string, sub?: string): RuleBreadcrumb {
  const query = new URLSearchParams({ group })
  if (sub) query.set('sub', sub.replace(/^\//, ''))
  return { label, to: `/rules?${query.toString()}` }
}

function currentCrumb(title: string): RuleBreadcrumb {
  return { label: title || 'Rules Reference' }
}

function parentRuleCrumb(name: string, sourcePath: string): RuleBreadcrumb {
  return { label: name, to: ruleReaderPath(sourcePath) }
}

function childPath(sourcePath: string, parentPath: string) {
  return sourcePath !== parentPath && sourcePath.startsWith(`${parentPath}/`)
}

function findIndexGroupForEntry(sourcePath: string, groups: RuleIndexGroup[]) {
  return groups.find((group) => group.entries.some((entry) => entry.sourcePath === sourcePath))
}

export function getRuleBreadcrumbs(
  sourcePath: string,
  currentTitle: string,
  indexGroups: RuleIndexGroup[] = [],
): RuleBreadcrumb[] {
  const current = currentTitle || prettyPathPart(sourcePath.split('/').filter(Boolean).at(-1) || 'Quick Reference')
  const rulesRoot: RuleBreadcrumb = { label: 'Rules', to: '/rules' }

  if (sourcePath === '/') {
    return [rulesRoot, groupCrumb('Reference Updates', 'updates'), currentCrumb('Quick Reference')]
  }

  for (const support of supportPages) {
    if (sourcePath === support.sourcePath) {
      return [rulesRoot, groupCrumb('Reference Updates', 'updates'), currentCrumb(support.name)]
    }
    if (childPath(sourcePath, support.sourcePath)) {
      return [
        rulesRoot,
        groupCrumb('Reference Updates', 'updates'),
        parentRuleCrumb(support.name, support.sourcePath),
        currentCrumb(current),
      ]
    }
  }

  for (const army of armies) {
    const parentPath = armySourcePath(army.slug)
    if (sourcePath === parentPath) {
      return [rulesRoot, groupCrumb('Army Rules', 'armies'), currentCrumb(army.name)]
    }
    if (childPath(sourcePath, parentPath)) {
      return [
        rulesRoot,
        groupCrumb('Army Rules', 'armies'),
        parentRuleCrumb(army.name, parentPath),
        currentCrumb(current),
      ]
    }
  }

  const coreEntrySection = ruleSections.find((section) => coreSlugs.has(section.slug) && coreRuleEntrypoints[section.slug] === sourcePath)
  if (coreEntrySection) {
    return [rulesRoot, groupCrumb('Core Rules', 'core'), currentCrumb(current)]
  }

  // Pages in the four phase-reading sequences belong to Core Rules even though those
  // same repository paths also appear in the full Advanced Rules index. Keeping this
  // mapping ahead of the live-index lookup makes breadcrumbs follow the user's Core path.
  for (const sequence of corePhaseSequences) {
    const step = sequence.steps.find((entry) => entry.sourcePath === sourcePath)
    if (!step) continue
    return [
      rulesRoot,
      groupCrumb('Core Rules', 'core'),
      { label: sequence.name, to: ruleReaderPath(sequence.sequencePath) },
      currentCrumb(current),
    ]
  }

  const coreFlowEntry = coreRuleFlow.find((entry) => entry.sourcePath === sourcePath)
  if (coreFlowEntry) {
    return [rulesRoot, groupCrumb('Core Rules', 'core'), currentCrumb(current)]
  }

  const liveParent = findIndexGroupForEntry(sourcePath, indexGroups)
  if (liveParent) {
    if (scenarioPaths.has(liveParent.sourcePath)) {
      const scenarioName = scenarioNames.get(liveParent.sourcePath) || liveParent.name
      return [
        rulesRoot,
        groupCrumb('Battle Scenarios', 'scenarios'),
        { label: scenarioName, to: ruleIndexGroupPath('scenarios', liveParent.sourcePath) },
        currentCrumb(current),
      ]
    }

    return [
      rulesRoot,
      groupCrumb('Advanced Rules', 'advanced'),
      { label: liveParent.name, to: ruleIndexGroupPath('advanced', liveParent.sourcePath) },
      currentCrumb(current),
    ]
  }

  for (const scenario of battleScenarioEntries) {
    if (sourcePath === scenario.sourcePath) {
      return [
        rulesRoot,
        groupCrumb('Battle Scenarios', 'scenarios'),
        currentCrumb(scenario.name),
      ]
    }
    if (childPath(sourcePath, scenario.sourcePath)) {
      return [
        rulesRoot,
        groupCrumb('Battle Scenarios', 'scenarios'),
        { label: scenario.name, to: ruleIndexGroupPath('scenarios', scenario.sourcePath) },
        currentCrumb(current),
      ]
    }
  }

  for (const section of ruleSections) {
    if (sourcePath !== section.sourcePath && !childPath(sourcePath, section.sourcePath)) continue
    const group = coreSlugs.has(section.slug)
      ? groupCrumb('Core Rules', 'core')
      : groupCrumb('Advanced Rules', 'advanced')

    if (sourcePath === section.sourcePath) {
      return [rulesRoot, group, currentCrumb(section.name)]
    }

    return [rulesRoot, group, parentRuleCrumb(section.name, section.sourcePath), currentCrumb(current)]
  }

  return [rulesRoot, currentCrumb(current)]
}
