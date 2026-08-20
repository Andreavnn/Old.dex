import type { PrototypeEquipmentOption } from '../data/builderPrototype'

function addUnique(target: string[] | undefined, values: string[]) {
  return [...new Set([...(target || []), ...values].filter(Boolean))]
}

function sameScope(a: PrototypeEquipmentOption, b: PrototypeEquipmentOption) {
  return (a.requiresSelection || '') === (b.requiresSelection || '')
}

function candidateOptions(option: PrototypeEquipmentOption, rows: PrototypeEquipmentOption[]) {
  const scoped = rows.filter((candidate) => candidate.id !== option.id && sameScope(option, candidate))
  return scoped.length ? scoped : rows.filter((candidate) => candidate.id !== option.id)
}

/** Infer only explicit, mechanically safe dependencies stated in source notes. */
export function inferEquipmentOptionDependencies(rows: PrototypeEquipmentOption[], baseSpecialRules = '') {
  const baseFrenzy = /\bFrenzy\b/i.test(baseSpecialRules)
  for (const option of rows) {
    const note = String(option.note || '')
    if (!note) continue
    const candidates = candidateOptions(option, rows)

    if (/\b(?:only\s+)?if\b[^.;]*\bfrenz(?:y|ied)\b/i.test(note) && !baseFrenzy) {
      const frenzy = candidates.filter((candidate) => /^Frenzy(?:\b|\s*\()/i.test(candidate.name) || /:\s*Frenzy(?:\b|\s*\()/i.test(candidate.name))
      if (frenzy.length) option.requiresAnySelection = addUnique(option.requiresAnySelection, frenzy.map((candidate) => candidate.id))
    }

    if (/\bif\b[^.;]*\b3\s+crew\s+members?\b/i.test(note)) {
      const thirdCrew = candidates.filter((candidate) => /\bthird\b[^,;]*\bcrew\s+member\b/i.test(candidate.name) || /\b3(?:rd)?\b[^,;]*\bcrew\b/i.test(candidate.name))
      if (thirdCrew.length) option.requiresAllSelections = addUnique(option.requiresAllSelections, thirdCrew.map((candidate) => candidate.id))
    }

    if (/\bif\b[^.;]*\b2\s+crew\s+members?\b/i.test(note)) {
      const thirdCrew = candidates.filter((candidate) => /\bthird\b[^,;]*\bcrew\s+member\b/i.test(candidate.name) || /\b3(?:rd)?\b[^,;]*\bcrew\b/i.test(candidate.name))
      if (thirdCrew.length) option.forbidsSelection = addUnique(option.forbidsSelection, thirdCrew.map((candidate) => candidate.id))
    }

    if (/\b(?:only\s+)?if\s+(?:appropriately\s+)?mounted\b|\bwhile mounted\b|\bwhen mounted\b/i.test(note) && option.kind !== 'mount-option') option.requiresMounted = true

    // Generic explicit dependencies are inferred only when the source note uses
    // prerequisite language and names another option in the same scope.
    if (/\b(?:requires?|only (?:available|usable)|may only be taken|can only be taken|only if|provided that)\b/i.test(note)) {
      const named = candidates.filter((candidate) => {
        const baseName = candidate.name.replace(/\s*\([^)]*\)\s*$/, '').trim()
        if (baseName.length < 4) return false
        const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
        return new RegExp(`\\b${escaped}\\b`, 'i').test(note)
      })
      if (named.length) option.requiresAllSelections = addUnique(option.requiresAllSelections, named.map((candidate) => candidate.id))
    }
  }
  return rows
}
