// Compatibility bridge retained for any older route/module that still imports the
// Alpha 0.34 helper. Match timing is now compiled centrally by matchIntelligence.
import { analyzeMatchRuleTiming } from '../domain/matchTiming'
import { loadMatchTurnGuidance, type MatchGuidanceRule } from './matchIntelligence'
import type { GameSide, SavedGame } from './games'

export type GameTurnRuleV034 = MatchGuidanceRule

export function resolveTurnStepV034(text: string) {
  return analyzeMatchRuleTiming('', text)[0]?.step || ''
}

export function loadTurnStepGuidanceV034(game: SavedGame, stepId: string, viewSide: GameSide) {
  return loadMatchTurnGuidance(game, stepId, viewSide)
}
