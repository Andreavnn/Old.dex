export type ChargeMatchEffects = {
  maximumChargeRangeBonus: number
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

export function extractChargeMatchEffects(label: string, text: string): ChargeMatchEffects {
  const source = `${label || ''} ${text || ''}`.replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()

  // Swiftstride changes the maximum possible charge distance by adding an
  // additional charge die. Keeping this as canonical rule identity avoids
  // making match calculations dependent on a live rule-page fetch.
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

  // When a rule states both a maximum-range increase and a charge-roll bonus
  // (Waaagh! Banner is the canonical example), those are two descriptions of
  // the same possible reach and must not be double-counted.
  return {
    maximumChargeRangeBonus: Math.max(canonical, explicitRange, rollMaximum),
    chargeRollModifier: rollModifier ? String(rollModifier).toUpperCase() : undefined,
  }
}
