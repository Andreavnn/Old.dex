import { loadTurnStepGuidance as loadBaseTurnStepGuidance, type GameTurnRule } from './gameSetup'

export type GameTurnRuleV033 = Omit<GameTurnRule, 'action'> & { action?: GameTurnRule['action'] | 'spell' }
import type { SavedGame } from './games'

// Exact subphase cues are deliberately evaluated before broad phase language.
// This prevents a rule that names Rallying Fleeing Troops from also leaking into
// Command merely because its page contains a generic Strategy/Command sentence.
const exactStepPatterns: Record<string, RegExp> = {
  'start-of-turn': /\b(?:start|beginning) of (?:your|the|each|every|a) turn\b/i,
  command: /\bcommand sub-?phase\b|\bduring (?:your|the) command sub-?phase\b/i,
  conjuration: /\bconjuration sub-?phase\b|\benchantment\b|\bhex\b/i,
  rally: /\brallying fleeing troops\b|\brally sub-?phase\b|\brally test\b/i,
  'required-charges': /\brequired charge test\b|\bimpetuous test\b/i,
  'declare-charges': /\bdeclare charges?\b|\bdeclare a charge\b|\bcharge reaction\b/i,
  'charge-moves': /\bcharge moves?\b|\bfailed charge\b/i,
  'compulsory-moves': /\bcompulsory moves?\b|\bfleeing move\b|\brandom movement\b/i,
  'remaining-moves': /\bremaining moves?\b|\bconveyance\b/i,
  'special-shooting': /\bspecial shooting actions?\b|\bmagic missile\b|\bmagical vortex\b/i,
  shooting: /\bshooting attacks?\b|\bshooting phase\b|\bmissile weapon\b/i,
  fight: /\bfight sub-?phase\b|\bassailment\b|\bin initiative order\b/i,
  'combat-result': /\bcombat result\b|\bcombat resolution\b/i,
  'break-test': /\bbreak tests?\b/i,
  'follow-up': /\bfollow up\b|\bpursu(?:e|it|ing)\b|\brestrain(?:ing)?\b/i,
  'end-turn': /\bend of (?:your|the|each|every|a) turn\b/i,
}

const exactSpecificityOrder = [
  'rally', 'required-charges', 'declare-charges', 'charge-moves', 'compulsory-moves', 'remaining-moves',
  'special-shooting', 'combat-result', 'break-test', 'follow-up', 'fight', 'shooting', 'conjuration', 'command',
  'start-of-turn', 'end-turn',
] as const

const broadFallbackPatterns: Record<string, RegExp> = {
  command: /\bcommand\b/i,
  conjuration: /\bcast(?:ing)?\b.*\bspell\b|\bdispel(?:ling)?\b/i,
  rally: /\brallying\b/i,
  'required-charges': /\brequired charge\b|\bimpetuous\b|\bmust charge\b/i,
  'declare-charges': /\bcharg(?:e|ed|ing)\b/i,
  'charge-moves': /\bcharg(?:e|ed|ing)\b/i,
  'compulsory-moves': /\bmovement phase\b|\breserve\b|\breinforcement\b/i,
  'remaining-moves': /\bmovement phase\b|\bmarch(?:ing)?\b/i,
  'special-shooting': /\bshooting phase\b/i,
  shooting: /\bshooting phase\b/i,
  fight: /\bcombat phase\b|\bmelee\b|\bfight(?:ing)?\b/i,
  'combat-result': /\bcombat phase\b/i,
  'break-test': /\bcombat phase\b/i,
  'follow-up': /\bcombat phase\b/i,
}

function ruleText(rule: GameTurnRuleV033) { return `${rule.label} ${rule.summary || ''}` }

function canonicalStep(rule: GameTurnRuleV033, requested: string) {
  const text = ruleText(rule)
  const exact = Object.entries(exactStepPatterns).filter(([, pattern]) => pattern.test(text)).map(([step]) => step)
  if (exact.length) {
    // A rule page can mention a broad subphase while explaining a more specific
    // point in the order of operations. Route to the most specific named cue
    // rather than keeping whichever step happened to request the page. This is
    // what keeps Rallying Cry in Rallying Fleeing Troops instead of Command, and
    // Combat Result / Break Test / Follow Up out of the general Fight step.
    return exactSpecificityOrder.find((step) => exact.includes(step)) || exact[0]
  }
  const fallback = Object.entries(broadFallbackPatterns).filter(([, pattern]) => pattern.test(text)).map(([step]) => step)
  if (!fallback.length) return requested
  if (fallback.includes(requested) && fallback.length === 1) return requested
  // Broad phase-only language should not cause one rule to populate every
  // subphase. Prefer the first semantically useful subphase for that wording.
  return fallback[0]
}

function casterNames(game: SavedGame) { return new Set((game.magicSetup || []).map((row) => row.name.toLowerCase())) }

export async function loadTurnStepGuidanceV033(game: SavedGame, stepId: string, viewSide: 'player' | 'opponent'): Promise<GameTurnRuleV033[]> {
  const rows = await loadBaseTurnStepGuidance(game, stepId, viewSide)
  const casters = casterNames(game)
  return rows.flatMap((row) => {
    const normalized: GameTurnRuleV033 = { ...row }
    if (stepId === 'required-charges' && /^multiple units$/i.test(normalized.source)) normalized.source = 'Required Charge Test'
    if (casters.has(String(normalized.source || '').toLowerCase()) && /\bType:\s*(?:Assailment|Magic Missile|Magical Vortex|Enchantment|Hex|Conveyance)\b/i.test(normalized.summary || '')) {
      normalized.action = 'spell'
    }
    // Explicit game-generated charge candidates are already assigned to the
    // correct step and must not be reclassified by their explanatory text.
    if (normalized.action === 'declare-charge') return [normalized]
    return canonicalStep(normalized, stepId) === stepId ? [normalized] : []
  })
}
