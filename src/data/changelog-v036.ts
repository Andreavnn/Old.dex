import type { ChangelogEntry } from './changelog'

export const changelogV036: ChangelogEntry = {
  version: '0.36',
  title: 'Sequential match resolution, joined characters, and combat tracking',
  notes: [
    'Changed Start New Match battle-composition options to compact pill UI instead of expanded explanatory rows.',
    'Moved available scenario/battle artwork into the bottom of the expandable Scenario Rules content on Setup, Overview, and Deployment Order so the same scenario reference pattern is used throughout pre-battle play.',
    'Collapsed each Wizard or Priest into its own independent Setup Step 2 section, reducing clutter when a roster contains multiple casters.',
    'Added match-only character attachment tracking during Deployment. Friendly Characters can be joined to a unit, appear inside that host during later match actions, and can leave the unit during Remaining Moves without changing the saved roster.',
    'Combined Declare Charges and Charge Moves into one sequential Declare & Resolve Charges step. Each charge is declared, rolled, resolved, and marked complete before the next charge, with the unit’s relevant charge rules displayed directly in its entry.',
    'Rebuilt Remaining Moves around unit state: units that declared a charge, resolved compulsory movement, remain joined to another unit, or are still held in Reserve are excluded. Eligible units are shown directly with optional completion tracking.',
    'Added request-version guarding to asynchronous match guidance so a slow rule lookup from a previous phase or subphase cannot overwrite the currently selected step. This prevents Required Charge Test text such as Impetuous modifiers from leaking into Remaining Moves.',
    'Reworked Choose & Fight Combat into expandable unit entries with in-place characteristic profiles and joined-character profiles for roll reference.',
    'Expanded Calculate Combat Result with tracked destroyed-model counts, Banner/Champion/Musician loss checks when present, joined-character casualties, and optional Won Combat / Failed Break Test state.',
    'Combined Break Test with Follow Up & Pursuit. Units flagged from Combat Result can record Give Ground, Fall Back in Good Order, Flee or destruction plus Follow Up, Pursue, Restrain, Overrun, or no follow-up before the next combat is resolved.',
    'Replaced exposed horizontal match phase/subphase scrollbars with left and right arrow controls while retaining touch/trackpad scrolling internally.',
    'Bumped the installed-app shell and package version to Alpha Build 0.36.',
  ],
}
