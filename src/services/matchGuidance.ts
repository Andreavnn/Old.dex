// Compatibility facade. Canonical Match guidance mechanics live in matchIntelligence.ts.
export { loadMatchDeploymentGuidance, loadMatchStartRoundGuidance, loadMatchTurnGuidance } from './matchIntelligence'
export type {
  MatchDeploymentGuidance,
  MatchGuidanceRule,
  MatchStartRoundRule,
  MatchUnitRef as MatchGuidanceUnitRef,
} from './matchIntelligence'
