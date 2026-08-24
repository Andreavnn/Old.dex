import type { ChangelogEntry } from './changelog'

export const changelogV034: ChangelogEntry = {
  version: '0.34',
  title: 'Match workflow corrections, charge tracking, and Legends of Legacy',
  notes: [
    'Added lock and delete controls to open matches. Locked matches remain reviewable but cannot be edited until unlocked from Games.',
    'Extended match-page bottom spacing and mobile safe-area handling so navigation and lifecycle controls remain fully inside the page instead of hanging over the footer.',
    'Added a Held in Reserve control beside Deployed during deployment, with unavailable reserve choices visibly disabled when no reserve permission is detected.',
    'Removed decorative item-count bubbles from match task-panel headings while retaining meaningful turn, phase, subphase and deployment progress information.',
    'Reduced Start of Round to rules and actions that actually resolve there; round number, first player and passive battle-condition summaries remain available elsewhere rather than occupying the Start of Round task list.',
    'Corrected the timing resolver so explicit named subphases take priority over what a rule does. Rallying Cry now resolves in Command as its rule states, rather than being moved to Rallying Fleeing Troops because it rallies a unit.',
    'Strengthened Required Charge Test detection by supplementing roster special rules such as Impetuous and routing scenario text about testing whether a unit must charge into Required Charge Tests instead of Declare Charges.',
    'Rebuilt Declare Charges as a simple unit checklist with maximum possible charge range, detected Swiftstride/range bonuses, required-charge status, and an in-phase charge procedure tip instead of expandable unit rule cards.',
    'Added phase/subphase tips throughout Strategy, Movement, Shooting, Combat and End of Round, following the older Old.dex battle workflow pattern of showing the immediate procedure beside the actions to resolve.',
    'Expanded phase-aware battle guidance so selected battlefield effects and Wizard spells are shown in the subphase where their text or spell type says they can be resolved.',
    'Improved pill and chip contrast across themes by using black text for light pill-style UI surfaces by default.',
    'Moved all Legacy PDF armies out of their official-book family groupings and into a dedicated Legends of Legacy army-rules category below Ravening Hordes.',
  ],
}
