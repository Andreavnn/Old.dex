/** Pure characteristic/save math used by the canonical profile engine. */
export function improveSaveBy(value: string, amount = 1) {
  const parsed = Number.parseInt(String(value || ''), 10)
  const base = Number.isFinite(parsed) ? parsed : 7
  return `${Math.max(2, base - Math.max(0, amount))}+`
}

export function incrementCharacteristic(value: string, amount: number) {
  const numeric = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(numeric) ? String(numeric + amount) : value
}

export function resolveArmourSave(baseSave: string, replacementSave: string | undefined, modifiers: number[]) {
  let result = replacementSave || baseSave || '—'
  const total = modifiers.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
  if (total > 0) result = improveSaveBy(result, total)
  return result
}
