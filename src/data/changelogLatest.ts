import type { ChangelogEntry } from './changelog'

export const latestChangelogEntry: ChangelogEntry = {
  version: '0.43',
  title: 'Persistent match state, snapshot profiles, and guided-play UI correction',
  notes: [
    'Removed the blanket Dark Mode pill/chip black-text override at the semantic theme layer. Neutral pills now follow theme surfaces while rule/spell pills keep readable accent treatment; Combat Result and score steppers are explicitly theme-safe.',
    'Moved Battle March condition resolution to operational Match timing: Disruptive Weather and Wilderness Terrain resolve at Deployment, while Chaos of War is surfaced at Start of Turn from round 2. Setup now selects conditions without expanding their rules tables.',
    'Replaced Setup Step 2’s parallel spell renderer with a shared canonical spell-box component so match spell choices use the same rule-box structure as other Old.dex spell/rule surfaces.',
    'Grouped Deployment entries into visible placement order: ordinary units, War Machines, Characters, then Scouts/special deployment, while retaining reserve and joined-character exceptions.',
    'Added Leadership to Required Charge Test entries, roster-derived Movement to Remaining Moves, and BS plus selectable To Hit penalties to Shooting.',
    'Added a dedicated match-roster profile route built from the roster snapshot saved when the match began. Choose & Fight Combat unit panels are fully clickable and no longer depend on List Builder routing to reconstruct roster selections.',
    'Extended persistent match tracking with actual limited-use counters, charge/combat history, and fleeing state. Fleeing units surface in Rally and Compulsory Moves until they successfully rally or leave play.',
    'Changed single-model Combat status text to Wounds Remaining while retaining model-count wording for multi-model units.',
    'Rebuilt maximum declaration range as named, stackable active-source contributions. Swiftstride and Waaagh! Banner now produce the required M + 6 + source bonuses breakdown without counting unselected upgrades.',
    'Hardened guided-match width, shrink, wrapping, and narrow-screen layout rules to prevent panels and text from crossing the main Match card borders.',
    'Added Alpha 0.43 regression coverage for charge-source breakdowns, limited-use scopes, persistent fleeing, canonical spell boxes, snapshot profile routing, and Dark Mode pill correction.',
    'Bumped package/header/footer/PWA cache metadata to Alpha Build 0.43.',
  ],
}
