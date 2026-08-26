import type { MatchActionStep, MatchRuleIntent, MatchTurnAffinity } from './matchTiming'

export type MatchRuleOwnerSide = 'player' | 'opponent' | 'battle'
export type MatchRuleViewSide = 'player' | 'opponent'

/**
 * Canonical turn-ownership gate for compiled match guidance.
 *
 * A roster owns its rules. When that roster is the active side, own/either-turn
 * rules may display and explicit enemy-turn rules may not. When that roster is
 * inactive, only explicit opponent-turn reactions cross the boundary. Untimed
 * rules are allowed across sides only for shared combat-resolution operations.
 */
export function matchRuleVisibleForTurn(input: {
  ownerSide: MatchRuleOwnerSide
  viewSide: MatchRuleViewSide
  turn: MatchTurnAffinity
  intent?: MatchRuleIntent
  step: MatchActionStep
}) {
  const { ownerSide, viewSide, turn, intent, step } = input

  if (ownerSide === 'battle') return turn !== (viewSide === 'player' ? 'enemy' : 'own')

  const ownerIsActive = ownerSide === viewSide
  if (ownerIsActive) return turn !== 'enemy'

  if (turn === 'enemy') return true
  if (intent === 'reaction' && turn !== 'own') return true

  const sharedResolution: MatchActionStep[] = ['fight', 'combat-result', 'break-test', 'follow-up']
  return turn === 'either' && sharedResolution.includes(step)
}
