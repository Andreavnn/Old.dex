export type CoreRuleNavTarget = {
  name: string
  sourcePath: string
}

export type CorePhaseSequence = {
  name: string
  sequencePath: string
  steps: CoreRuleNavTarget[]
  nextCore: CoreRuleNavTarget
}

export const coreRuleFlow: CoreRuleNavTarget[] = [
  { name: 'The Strategy Phase', sourcePath: '/the-strategy-phase/the-strategy-phase-sequence' },
  { name: 'The Movement Phase', sourcePath: '/the-movement-phase/the-movement-phase-sequence' },
  { name: 'The Shooting Phase', sourcePath: '/the-shooting-phase/the-shooting-phase-sequence' },
  { name: 'The Combat Phase', sourcePath: '/the-combat-phase/the-combat-phase-sequence' },
  { name: 'Magic', sourcePath: '/magic/casting-spells' },
  { name: 'Special Rules', sourcePath: '/special-rules/what-are-special-rules' },
  { name: 'Weapons of War', sourcePath: '/weapons-of-war/weapon-profiles' },
]

export const corePhaseSequences: CorePhaseSequence[] = [
  {
    name: 'The Strategy Phase',
    sequencePath: '/the-strategy-phase/the-strategy-phase-sequence',
    steps: [
      { name: 'Start of Turn', sourcePath: '/the-strategy-phase/start-of-turn' },
      { name: 'Command', sourcePath: '/the-strategy-phase/command' },
      { name: 'Conjuration', sourcePath: '/the-strategy-phase/conjuration' },
      { name: 'Rally Fleeing Units', sourcePath: '/the-strategy-phase/rally-fleeing-units' },
    ],
    nextCore: { name: 'The Movement Phase Sequence', sourcePath: '/the-movement-phase/the-movement-phase-sequence' },
  },
  {
    name: 'The Movement Phase',
    sequencePath: '/the-movement-phase/the-movement-phase-sequence',
    steps: [
      { name: 'Declare Charges & Charge Reactions', sourcePath: '/the-movement-phase/declare-charges-and-charge-reactions' },
      { name: 'Charge Moves', sourcePath: '/the-movement-phase/charge-moves' },
      { name: 'Compulsory Moves', sourcePath: '/the-movement-phase/compulsory-moves' },
      { name: 'Remaining Moves', sourcePath: '/the-movement-phase/remaining-moves' },
    ],
    nextCore: { name: 'The Shooting Phase Sequence', sourcePath: '/the-shooting-phase/the-shooting-phase-sequence' },
  },
  {
    name: 'The Shooting Phase',
    sequencePath: '/the-shooting-phase/the-shooting-phase-sequence',
    steps: [
      { name: 'Choose Unit & Declare Target', sourcePath: '/the-shooting-phase/choose-unit-and-declare-target' },
      { name: 'Roll to Hit (Shooting)', sourcePath: '/the-shooting-phase/roll-to-hit-shooting' },
      { name: 'Roll to Wound & Make Armour Saves (Shooting)', sourcePath: '/the-shooting-phase/roll-to-wound-and-make-armour-saves-shooting' },
      { name: 'Remove Casualties & Make Panic Tests', sourcePath: '/the-shooting-phase/remove-casualties-and-make-panic-tests' },
    ],
    nextCore: { name: 'The Combat Phase Sequence', sourcePath: '/the-combat-phase/the-combat-phase-sequence' },
  },
  {
    name: 'The Combat Phase',
    sequencePath: '/the-combat-phase/the-combat-phase-sequence',
    steps: [
      { name: 'Choose & Fight Combat', sourcePath: '/the-combat-phase/choose-and-fight-combat' },
      { name: 'Calculate Combat Result', sourcePath: '/the-combat-phase/calculate-combat-result' },
      { name: 'Break Test', sourcePath: '/the-combat-phase/break-test' },
      { name: 'Follow Up & Pursuit', sourcePath: '/the-combat-phase/follow-up-and-pursuit' },
    ],
    nextCore: { name: 'Magic', sourcePath: '/magic/casting-spells' },
  },
]

export function getSequenceStepNavigation(sourcePath: string) {
  for (const sequence of corePhaseSequences) {
    if (sourcePath === sequence.sequencePath) {
      return {
        previous: undefined,
        next: sequence.steps[0],
      }
    }

    const index = sequence.steps.findIndex((step) => step.sourcePath === sourcePath)
    if (index < 0) continue

    return {
      previous: index === 0
        ? { name: `${sequence.name} Sequence`, sourcePath: sequence.sequencePath }
        : sequence.steps[index - 1],
      next: index === sequence.steps.length - 1 ? sequence.nextCore : sequence.steps[index + 1],
    }
  }
  return null
}

export function getCoreFlowNavigation(sourcePath: string) {
  const index = coreRuleFlow.findIndex((entry) => entry.sourcePath === sourcePath)
  if (index < 0) return null
  return {
    currentIndex: index,
    previous: index > 0 ? coreRuleFlow[index - 1] : undefined,
    next: index < coreRuleFlow.length - 1 ? coreRuleFlow[index + 1] : undefined,
    isPhaseSequence: index <= 3,
  }
}
