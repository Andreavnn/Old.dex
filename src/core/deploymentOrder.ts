import type { BuilderRosterSelection } from '../domain/rosterTypes'

type DeploymentRow = Pick<BuilderRosterSelection, 'category' | 'troopType' | 'keywords' | 'specialRules'>

function normalized(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Canonical deployment type text, including keyword fallbacks used by older/imported rosters. */
export function deploymentUnitType(row: DeploymentRow) {
  return [row.troopType, ...(row.keywords || []).map((entry) => entry.label)].map(normalized).filter(Boolean).join(' ')
}

export function isDeploymentCharacter(row: DeploymentRow) {
  return /character|general/.test(normalized(row.category))
}

export function isDeploymentWarMachine(row: DeploymentRow) {
  return /\bwar\s*machine\b/.test(deploymentUnitType(row))
}

export function isDeploymentScout(row: DeploymentRow) {
  return (row.specialRules || []).some((rule) => /^Scouts?(?:\s|\(|$)/i.test(String(rule.label || '')))
}

/** Ordinary units, War Machines, Characters, then models using Scouts deployment. */
export function deploymentSequenceRank(row: DeploymentRow) {
  if (isDeploymentScout(row)) return 3
  if (isDeploymentCharacter(row)) return 2
  if (isDeploymentWarMachine(row)) return 1
  return 0
}

export function deploymentSequenceLabel(row: DeploymentRow) {
  const rank = deploymentSequenceRank(row)
  if (rank === 3) return isDeploymentCharacter(row) ? 'SCOUT CHARACTER · SPECIAL DEPLOYMENT LAST' : 'SCOUTS · NORMAL DEPLOYMENT OR USE SCOUTS LATER'
  if (rank === 2) return 'CHARACTERS · DEPLOY LAST'
  if (rank === 1) return 'WAR MACHINE · TRACK THIS UNIT SEPARATELY'
  return 'UNITS · ALTERNATING DEPLOYMENT'
}
