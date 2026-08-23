import type { BuilderRosterSelection } from '../domain/rosterTypes'

const STORAGE_KEY = 'olddex.magic-allowance-approvals.v1'

type ApprovalMap = Record<string, string>

function readApprovals(): ApprovalMap {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ApprovalMap : {}
  } catch { return {} }
}

function writeApprovals(value: ApprovalMap) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)) } catch { /* local status remains non-blocking */ }
}

export type OpenMagicAllowance = {
  instanceId: string
  ownerId: string
  remaining: number
}

export function rosterOpenMagicAllowances(roster: BuilderRosterSelection[]): OpenMagicAllowance[] {
  return roster.flatMap((row) => (row.magicPools || []).flatMap((pool) => {
    const spent = (row.magicItems || [])
      .filter((item) => (item.ownerId || 'unit') === pool.ownerId)
      .reduce((sum, item) => sum + Number(item.points || 0) * Math.max(1, Number(item.count || 1)), 0)
    const remaining = Math.max(0, Number(pool.maxPoints || 0) - spent)
    return remaining > 0 ? [{ instanceId: row.instanceId, ownerId: pool.ownerId, remaining }] : []
  }))
}

export function magicAllowanceSignature(roster: BuilderRosterSelection[]) {
  return rosterOpenMagicAllowances(roster)
    .map((row) => `${row.instanceId}:${row.ownerId}:${row.remaining}`)
    .sort()
    .join('|')
}

export function isMagicAllowanceApproved(listId: string, roster: BuilderRosterSelection[]) {
  if (!listId) return false
  const signature = magicAllowanceSignature(roster)
  return Boolean(signature && readApprovals()[listId] === signature)
}

export function approveMagicAllowance(listId: string, roster: BuilderRosterSelection[]) {
  if (!listId) return false
  const signature = magicAllowanceSignature(roster)
  if (!signature) return false
  const approvals = readApprovals()
  approvals[listId] = signature
  writeApprovals(approvals)
  return true
}

export function clearMagicAllowanceApproval(listId: string) {
  if (!listId) return
  const approvals = readApprovals()
  if (!(listId in approvals)) return
  delete approvals[listId]
  writeApprovals(approvals)
}
