export type ChargeMatchEffects = {
  maximumChargeRangeBonus: number
  chargeRollModifier?: string
}

export type ChargeRangeContribution = {
  label: string
  bonus: number
  chargeRollModifier?: string
}

function diceMaximum(value: string) {
  const clean = String(value || '').trim()
  const die = clean.match(/^D(\d+)$/i)
  if (die) return Math.max(0, Number(die[1]) || 0)
  const numeric = clean.match(/^\+?(\d+)$/)
  return numeric ? Math.max(0, Number(numeric[1]) || 0) : 0
}

function highestBonus(text: string, patterns: RegExp[]) {
  const values: number[] = []
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) values.push(diceMaximum(match[1] || ''))
  }
  return values.length ? Math.max(...values) : 0
}

function contributionLabel(value: string) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

export function extractChargeMatchEffects(label: string, text: string): ChargeMatchEffects {
  const source = `${label || ''} ${text || ''}`.replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()

  // Declaration reach is a distinct contract from the resolved Charge roll.
  // Swiftstride contributes +3 to maximum declaration range; the actual charge
  // still resolves with the dice/rules printed by the core charge procedure.
  const canonical = /^Swiftstride(?:\s|\(|$)/i.test(label || '') ? 3 : 0

  const explicitRange = highestBonus(source, [
    /(?:increases?|increase|increased)\s+(?:its|the unit'?s|this model'?s|the bearer'?s)?\s*(?:maximum (?:possible )?)?charge range\s+by\s+(\d+|D3|D6)\s*["”']?/gi,
    /(?:maximum (?:possible )?)?charge range\s+(?:is )?(?:increased|increases?)\s+by\s+(\d+|D3|D6)\s*["”']?/gi,
    /(?:add|adds|adding)\s+(\d+|D3|D6)\s*(?:["”']\s*)?to (?:this model'?s|the unit'?s|its|the bearer'?s)?\s*(?:maximum )?charge range/gi,
  ])

  const rollMatches = [
    ...source.matchAll(/(?:add|adds|adding|apply(?:ing)?|gains?)\s+(?:a\s+)?(?:\+\s*)?(\d+|D3|D6)\s*(?:modifier\s*)?(?:to|on)\s+(?:its|the unit'?s|this model'?s|the bearer'?s)?\s*charge roll/gi),
    ...source.matchAll(/charge roll[^.]{0,100}(?:\+|bonus of|modifier of)\s*(\d+|D3|D6)/gi),
  ]
  const rollModifier = rollMatches.map((match) => match[1]).find(Boolean)
  const rollMaximum = rollModifier ? diceMaximum(rollModifier) : 0

  // If one rule states both a range increase and a roll modifier, those are
  // two descriptions of one source of reach and are counted once.
  return {
    maximumChargeRangeBonus: Math.max(canonical, explicitRange, rollMaximum),
    chargeRollModifier: rollModifier ? String(rollModifier).toUpperCase() : undefined,
  }
}

export function chargeRangeContribution(label: string, text: string, storedBonus = 0, storedChargeRollModifier?: string): ChargeRangeContribution | null {
  const extracted = extractChargeMatchEffects(label, text)
  const bonus = Math.max(Math.max(0, Number(storedBonus || 0)), extracted.maximumChargeRangeBonus)
  if (!bonus) return null
  return {
    label: contributionLabel(label) || 'Rule bonus',
    bonus,
    chargeRollModifier: storedChargeRollModifier || extracted.chargeRollModifier,
  }
}

export function formatMaximumDeclarationRange(movement: number, contributions: ChargeRangeContribution[], baseChargeMaximum = 6) {
  const m = Math.max(0, Math.floor(Number(movement || 0)))
  const base = Math.max(0, Math.floor(Number(baseChargeMaximum || 0)))
  const active = contributions.filter((row) => Number(row.bonus) > 0)
  const total = m + base + active.reduce((sum, row) => sum + Math.max(0, Number(row.bonus || 0)), 0)
  if (!m) return { total: 0, text: 'Maximum declaration range could not be derived from the saved match snapshot.' }
  const extras = active.map((row) => ` + ${Math.max(0, Number(row.bonus || 0))} ${row.label}`).join('')
  return { total, text: `Maximum declaration range: M ${m} + ${base}${extras} = ${total}"` }
}
