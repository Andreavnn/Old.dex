import type { ChangelogEntry } from './changelog'

export const changelogV037: ChangelogEntry = {
  version: '0.37',
  title: 'Match rule fidelity, join restrictions, and battle-control polish',
  notes: [
    'Kept generic pill UI on a fixed high-contrast light treatment when Dark Mode is active so pill labels remain readable and do not inherit dark-theme text/background combinations.',
    'Tied the supplied ready_for_murderin_orc.mp3 directly to the installed-application launch scene. Every standalone app load that shows the launch scene now attempts the boot sound at the same time, while retaining the existing Settings audio switch and user-gesture fallback when autoplay is blocked.',
    'Changed normal match length to four rounds. A selected scenario can still replace that value when its own rules provide an explicit game length; the generic six-round source fallback no longer overrides Old.dex’s normal four-round setup default.',
    'Removed left/right subphase arrows when a phase has only one step and added rail padding/nowrap safeguards so the final visible phase label does not collide with the scroll edge.',
    'Restricted Deployment character-joining choices by troop/mount class. Characters now fail closed when their selected mount or troop class is incompatible with the prospective host, and Chariot, War Machine, Behemoth and Swarm-style models are not offered as ordinary joined-unit targets.',
    'Changed Step Notes to a single collapsible Note panel that is closed by default.',
    'Rebuilt match rule-card text cleanup to remove source-page navigation, Table of Contents, update metadata and publication/page noise while retaining the complete cleaned mechanical rule text instead of only the one sentence that established timing.',
    'Tightened Movement, Shooting and Combat timing inference so narrative words such as “march” no longer create tasks without an actual instruction, modifier or operational action. This removes magic-item/flavour false positives such as rules that merely describe warriors marching.',
    'Deduplicated canonical rule cards by rule identity rather than by the exact extracted sentence. When a joined Character and its host both have the same Individual rule, Old.dex shows one rule with all affected models where appropriate.',
    'Made Required Charge Test checkbox labels follow the global Text Size setting and increased spacing between affected-unit pills and rule-card dividers.',
    'Changed Choose & Fight Combat so joined Characters remain separate roster entries rather than appearing nested under their host. Each unit name now links to the roster-equivalent unit profile while the inline expandable profile remains available for rolling at the table.',
    'Changed Break Test and winner follow-up results from select menus to mutually exclusive checkbox choices. Losing/failed-break entries show only Break Test outcomes; Won Combat entries show only Follow Up / Pursuit choices.',
    'Simplified empty friendly/enemy action states to the explicit “No actions.” message.',
    'Bumped the package, header, footer and PWA shell to Alpha Build 0.37.',
  ],
}
