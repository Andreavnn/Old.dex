import type { ChangelogEntry } from './changelog'

const alpha046ChangelogEntry: ChangelogEntry = {
  version: '0.46',
  title: 'Canonical match spell cards, deployment gating, and combat-state tracking',
  notes: [
    'Returned Setup spell choices to the canonical RuleAbilityCard presentation already used by Special Rules and Magical Items, adding only the match Select control rather than maintaining a separate spell-card layout.',
    'Displayed castable spells in their correct phase and subphase with the same canonical rule box and added mutually exclusive Successful and Failed result tracking for each casting attempt.',
    'Enforced Deployment Step 2 stage order instead of only sorting it visually: ordinary units resolve before War Machines, War Machines before Characters, and Scouts or special deployment last.',
    'Restyled the Disruptive Weather Battle Condition as the same expandable rule-panel pattern used elsewhere while retaining its inline D6 table, recorded result, rules access, and required progression gate.',
    'Corrected the Tips master flip switch specificity conflict so the control renders as a proper switch instead of inheriting generic checkbox dimensions.',
    'Reduced and centered the Back and Next navigation controls so their labels cannot stretch beyond the match panel, while retaining Start Battle and Begin Round labels where useful.',
    'Carried successful charge state into Combat Step 1 with a visible Charged marker, including joined Characters through their host unit.',
    'Locked limited-use rule and item checkboxes as soon as their tracked uses are depleted.',
    'Added In Combat to Movement Step 2 charge resolution. Hold and In Combat are mutually exclusive with charge actions, while charge actions lock both Hold and In Combat.',
    'Rebuilt Army Roster entry actions into the compact square management-button pattern: Export, Lock, Enemy toggle, Copy, Share Code, and Delete where applicable.',
    'Bumped package, header, footer, and PWA cache metadata to Alpha Build 0.46.',
  ],
}
const alpha045ChangelogEntry: ChangelogEntry = {
  version: '0.45',
  title: 'Settings cleanup, Share Codes, rule resolution, and match UI refinement',
  notes: [
    'Reworked Settings rows to match the clearer Brambleheart presentation while preserving Old.dex Reset Local Data behavior, moved Site Changelog into Changelog & Updates, and removed underlines from download-style controls.',
    'Renamed Install to Access & Community, added Discord and Share actions in Settings and the global footer, moved Launch Audio above Themes, and simplified Donation controls.',
    'Replaced QR roster transfer with Old.dex Share Codes. QR generation, camera/image scanning, and QR-only dependencies are removed; the familiar QR-shaped roster-row icon now opens Share Code sharing instead.',
    'Share Codes are staged locally for review on the short /lists/shared route, including legacy payload links which have their long hash removed from the address bar after receipt. Roster import/export remain compact file transfer actions and Custom Data import remains in Settings.',
    'Hardened magic-item source resolution so exact item boundaries are respected on collection pages, non-weapon items no longer trigger unnecessary broad fallbacks, and collection-only items can still resolve when an individual route is missing.',
    'Changed the match Tips master control to a flip switch while retaining individual Tip checkboxes.',
    'Added a shared match-content gutter so text and controls no longer sit directly against panel borders across setup, deployment, phase, and combat surfaces.',
    'Reduced Setup spell-card Select, metadata, rule-link, and body text sizes; moved type/signature pills below the spell name; and normalized spell icon sizing.',
    'Restored Disruptive Weather as an always-visible required pre-deployment D6 table with inline rules access, saved result selection, and progression gating until a result is recorded.',
    'Bumped package/header/footer/PWA metadata to Alpha Build 0.45 and extended permanent regressions for the new UI and rule-resolution behavior.',
  ],
}

export const latestChangelogEntry: ChangelogEntry = {
  version: '0.47',
  title: 'Roster transfer consolidation, persistent magic state, and match presentation refinements',
  notes: [
    'Consolidated My Rosters import into one word-based action with file upload or Share Code entry, consolidated export into one action with file download or Share Code, added a left-side roster filter, and removed the page-level Delete control.',
    'Restored saved-roster actions in the requested order: View, Edit, Lock, Mark Enemy, Copy, Share, Delete. The enemy action uses the flag icon and is labeled Mark as Enemy Roster.',
    'Moved each roster point total beside the roster name and removed the redundant VALID / Locked status copy from roster cards.',
    'Made shared pill UI colors theme-independent so Dark Mode no longer recolors equipment, composition, rule, magic, and status pills.',
    'Game Length now prefers the minimum round count stated by a selected scenario when the scenario provides a range or minimum and the user has not customized the round count.',
    'Adjusted Setup spell-card layout so Select sits below the card accent edge and the spell type appears beneath the spell name.',
    'Added a universal Ongoing Battle Conditions panel at the top of battle phases, replacing phase-specific Wilderness Terrain reminder duplication.',
    'Redesigned limited-use action status as a larger text-size-aware remaining-use block rather than a miniature pill.',
    'Added Total Power and Miscast tracking to castable spells. Total Power also marks Miscast, the source Miscast table is selectable inline, casting lockouts persist for the appropriate phase or turn, and source-defined Wizard Level loss can track forgotten known spells.',
    'Moved Shooting weapon profiles above To Hit penalty controls and only expands mixed Ballistic Skill details when distinct BS values exist.',
    'Reworked winning Combat Result follow-up choices into the same card treatment as losing outcomes and added explicit roll/test instructions.',
    'Flattened End of Round Step 2 Round & Score Calculation into the step content instead of nesting it in a second panel.',
    'Bumped package, header, footer, Settings changelog label, Share Code metadata, and PWA cache metadata to Alpha Build 0.47.',
  ],
}

export const recentChangelogEntries: ChangelogEntry[] = [
  latestChangelogEntry,
  alpha046ChangelogEntry,
  alpha045ChangelogEntry,
]
