import { loadArmyData } from './armyData'
import { loadOwbRuleCatalog, resolveOwbRuleFromCatalog, splitOwbSourceList, type OwbRuleCatalog } from './owbRuleResolver'
import type { ArmyDataDocument, RawBuilderItem, RawBuilderUnit } from '../domain/rawArmyData'
import { isRecord } from '../domain/schemas'

export type OwbAuditIssue = {
  kind: 'unit' | 'mount' | 'weapon' | 'rule'
  owner: string
  name: string
  expectedPrefix: string
}
export type OwbAuditReport = {
  dataKey: string
  checked: number
  resolved: number
  unresolved: OwbAuditIssue[]
  resolutionRate: number
}

function englishText(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (!isRecord(value)) return ''
  return String(value.name_en || value.text_en || value.name || value.text || '').trim()
}

function specialRuleValue(item: RawBuilderItem | RawBuilderUnit) {
  return item.specialRules ?? item.special_rules ?? item.rules ?? item.rule ?? ''
}

function check(report: OwbAuditReport, catalog: OwbRuleCatalog, kind: OwbAuditIssue['kind'], owner: string, name: string, expectedPrefix: string) {
  if (!name) return
  report.checked += 1
  const resolved = resolveOwbRuleFromCatalog(catalog, name)
  if (resolved?.path.startsWith(expectedPrefix)) report.resolved += 1
  else report.unresolved.push({ kind, owner, name, expectedPrefix })
}

function likelyWeapon(value: string, catalog: OwbRuleCatalog) {
  return Boolean(resolveOwbRuleFromCatalog(catalog, value)?.path.startsWith('/weapons-of-war/'))
}

function walkItem(report: OwbAuditReport, catalog: OwbRuleCatalog, owner: string, item: RawBuilderItem, kind: 'mount' | 'weapon' | 'rule' = 'rule') {
  const name = englishText(item)
  if (kind === 'mount' && name && !/^On foot$/i.test(name)) check(report, catalog, 'mount', owner, name, '/unit/')
  if (kind === 'weapon' && name) {
    for (const part of splitOwbSourceList(name, catalog)) if (likelyWeapon(part, catalog)) check(report, catalog, 'weapon', owner, part, '/weapons-of-war/')
  }
  const ruleText = englishText(specialRuleValue(item))
  for (const rule of splitOwbSourceList(ruleText, catalog)) check(report, catalog, 'rule', owner || name, rule, '/')
  for (const child of Array.isArray(item.options) ? item.options : []) walkItem(report, catalog, `${owner} > ${name}`.replace(/^ > /, ''), child, 'weapon')
}

export async function auditOwbArmyData(dataKey: string): Promise<OwbAuditReport> {
  const [data, catalog] = await Promise.all([loadArmyData(dataKey) as Promise<ArmyDataDocument>, loadOwbRuleCatalog()])
  const report: OwbAuditReport = { dataKey, checked: 0, resolved: 0, unresolved: [], resolutionRate: 0 }
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue
    for (const raw of value as RawBuilderUnit[]) {
      const unitName = englishText(raw)
      if (!unitName) continue
      check(report, catalog, 'unit', unitName, unitName, '/unit/')
      for (const rule of splitOwbSourceList(englishText(specialRuleValue(raw)), catalog)) check(report, catalog, 'rule', unitName, rule, '/')
      for (const item of Array.isArray(raw.equipment) ? raw.equipment : []) walkItem(report, catalog, unitName, item, 'weapon')
      for (const item of Array.isArray(raw.options) ? raw.options : []) walkItem(report, catalog, unitName, item, 'weapon')
      for (const item of Array.isArray(raw.command) ? raw.command : []) walkItem(report, catalog, unitName, item, 'rule')
      for (const item of Array.isArray(raw.mounts) ? raw.mounts : []) walkItem(report, catalog, unitName, item, 'mount')
    }
  }
  report.resolutionRate = report.checked ? report.resolved / report.checked : 1
  return report
}
