export type ChangelogEntry = {
  version: string
  title: string
  notes: string[]
}

// Canonical history mirrored in /CHANGELOG.md. Keep both sources identical.
export const changelogEntries: ChangelogEntry[] = [
  { version: '0.57', title: 'Magic selection, composition options, display polish, and Games groundwork', notes: [
    'Refined roster percentage presentation so only the current percentage is status-coloured, zero-percent rows remain neutral, VALID/INVALID badges are centered, and Army List popouts/text-size controls fit their available space more reliably.',
    'Increased OLD.DEX/build/Changelog readability, deepened all light faction themes, improved Legions of Undead contrast, corrected dark-theme highlight text/icon contrast, and added four fixed user-selectable site background images.',
    'Added multi-category unit-picker tabs that preserve selections while moving between categories, an Over - Under option allowing a yellow-valid +10 point tolerance, and Monster Mash support for one eligible non-character Monstrous Creature, War Machine, or Chariot to count as Core.',
    'Added expandable Battle Composition option explanations and a Cancel action to list creation.',
    'Reworked Wizard Level into Wizard & Spell Lores, persisted selected spell/prayer lores into roster profiles, surfaced selected lores and source spell-like abilities as Special Rule cards, and retained magical-item fluff where available.',
    'Replaced the inline magical-item selector with a staged popup containing item-type tabs, live allowance accounting, unaffordable-item disabling, expandable descriptions, Finish-to-commit behavior, and X/Cancel discard behavior.',
    'Started the Games section with Start New Match, Open Matches, Match History, saved-list based match creation, and a persistent Setup/Overview/Deployment/Strategy/Movement/Shooting/Combat/End phase-step workflow based on the prepared Old World Battle groundwork.',
  ] },
  { version: '0.56', title: 'Roster status, current General, local-data reset, and faction themes', notes: [
    'Removed the stray divider above Army Validation issues and normalized Melee/Range special-rule pills to the same centered, regular-weight pill treatment used elsewhere.',
    'Added requirement-aware red/yellow/green status coloring to category percentages: minimum requirements progress from red to yellow to green, while maximum allowances progress from green to yellow to red as the limit is approached.',
    'Moved each roster unit/model point total into a centered rectangular badge above Edit/View/Copy/Remove controls and added a light (Current) marker after the roster model already assigned as General.',
    'Added a Reset local data action that clears saved lists, favorites, cached content, and other locally added Old.dex data while preserving Display settings.',
    'Replaced the Themes placeholder with collapsible Forces of Fantasy, Powers of Chaos, Legions of Undead, and Ravening Hordes theme switches, with dedicated light and dark palettes so Dark mode remains fully compatible.',
  ] },
  { version: '0.55', title: 'Roster totals, profile sizing, weapon AP, and publication completeness', notes: [
    'Removed percentages from the top roster point total while keeping category percentages as rounded whole numbers and preserving the selected/points/allowance percentage format within category summaries.',
    'Moved unit-size information beneath the profile points badge, placed model add/remove controls directly beneath the current model count, and removed the duplicate Unit Size field from Unit Details.',
    'Changed selected Magical Item cards to true two-column grid rows, centered melee/range weapon table content, reserved more width for Special Rule pills, and added conditional AP presentation for profile-level AP improvements such as Choppas and Armour Bane.',
    'Added contextual General labels that identify the other roster model currently selected as General, guaranteed a list-publication fallback for every live unit, and added spacing above roster validation issue rows.',
  ] },
  { version: '0.54', title: 'Rule-card links, settings hierarchy, and roster category accounting', notes: [
    'Capitalized special-rule callout keyword pills and linked Special Rule/Magical Item type pills directly to their underlying rule or item pages when available.',
    'Matched selected Magical Item cards to the same responsive two-column card flow used by Special Rules while retaining their attached owner, points, quantity, and removal controls.',
    'Reordered Settings so reporting appears first, moved reset controls and a Themes placeholder into Display, removed the separate Local section, and placed Donations immediately above Data & Content.',
    'Improved OLD.DEX/build/Changelog header spacing and changed roster category summaries to show selected count, points, allowance/requirement remaining, and current-versus-target percentages in one line.',
    'Renamed Composition Rule to Battle Composition and Composition Options to Battle Composition Options throughout list creation and list settings.',
  ] },
  { version: '0.53', title: 'Profile semantics, roster presentation, and project-history reconciliation', notes: [
    'Cleaned Magical Item and Army validation presentation, neutralized Special Rule/Magical Item type keywords, and centered the profile favorite control.',
    'Added Magical Attacks to profile keywords whenever an equipped magical weapon grants magical attacks, and split sentence-like special-rule parenthetical callouts into their own linked keyword pills.',
    'Changed mount Armour Save display to show the armour bonus contributed to the rider (for example +1 from Armoured Hide) or — when the mount contributes no armour bonus.',
    'Changed upgraded profile presentation so explicit upgrade profiles such as Big ’Uns replace the ordinary model profile instead of displaying both versions together.',
    'Renamed magic/composition options for clarity, added roster point percentages beside point totals/requirements/allowances, and added Settings placeholders for bug reporting and donations.',
    'Added the application-wide work-in-progress banner, increased the OLD.DEX header wordmark, and reconciled the in-app and GitHub changelogs into one duplicate-free canonical history.',
  ] },
  { version: '0.51–0.52', title: 'Army-list rules, dynamic profiles, points, and expanded icons', notes: [
    'Added Magical Category limiting and Magical Maelstrom composition behavior, including free maximum-plus-one Wizard levels and roster-wide category validation.',
    'Completed dynamic Ward Save, Regeneration, Armoured Hide, mount/rider characteristic, Wizard-level, magic-item, and war-machine weapon presentation in unit profiles.',
    'Unified unit point calculation across the picker, default roster entries, edited units, magic items, per-model equipment, and mixed-model weapon allocations.',
    'Added dedicated pill links for equipped weapon rules, moved Special Rule/Magical Item type markers into rule-card keyword footers, and standardized Army List typography, icons, pills, and validation UI.',
    'Removed match-only terrain/weather choices from list composition, stabilized dynamic-profile scrolling, fixed roster Edit autosave freezing, and expanded the icon pack with six spell-category icons.',
  ] },
  { version: '0.49–0.50', title: 'Source architecture, loadouts, and option normalization', notes: [
    'Made the Vue/TypeScript application the only implementation source, converted standalone preview output into a generated review artifact, and added ODX-CODE static analysis/regression coverage.',
    'Centralized loadout, persistence, schema, composition, network/storage, error-handling, and rule-helper behavior while reducing duplicate preview/CSS architecture.',
    'Finalized equipped-only melee/range tables, persistent Hand Weapon behavior, unit-level Shield selection, and explicit per-model mixed-armament allocation.',
    'Normalized Wizard starting levels, option prerequisites, Equipment & Options ordering, magic-item selection/removal, mount movement/bonuses, and dynamic Ward/Regeneration behavior across applicable units.',
  ] },
  { version: '0.47–0.48', title: 'Approved icons and equipped-weapon presentation', notes: [
    'Rebuilt the supplied characteristic/rule icon set from the approved artwork, including Attacks, Ward Save, Special Rule, Spell, and Regeneration corrections.',
    'Applied specific rule-category icons where available and retained the generic Special Rule icon only as a fallback.',
    'Changed melee/range profile tables to show only equipped weapons and moved optional weapon choices into Equipment & Options, with mixed-armament quantity controls where source rules require them.',
  ] },
  { version: '0.42–0.46', title: 'Builder selection-state stabilization', notes: [
    'Added the in-app Changelog and corrected source-included versus optional weapon/equipment/mount selections so defaults remain selected/locked and alternatives remain interactive.',
    'Stabilized Wizard level exclusivity and persistence so each Wizard displays one current level rather than multiple simultaneous defaults.',
    'Corrected owner-specific weapon/profile visibility, dynamic Ward Save rows, characteristic ordering/recentering, and queued multi-unit selection completion.',
    'Removed Available Lores from Unit Details when they represented choices rather than selected lores, and added the Custom Data Settings placeholder.',
  ] },
  { version: '0.39–0.41', title: 'Composition controls, profile icons, and Create List reliability', notes: [
    'Added characteristic icons and Regeneration to Army List profiles, composition options for Allies/Mercenaries/Custom Units, named-character General enforcement, and invalid-entry highlighting.',
    'Reorganized Settings, corrected Builder default/Wizard metadata handling, separated magic-item allowances by owner, and preserved Builder unit-size bounds.',
    'Fixed asynchronous Create List refresh state that could wipe selections or freeze the page while live composition data loaded.',
  ] },
  { version: '0.36–0.38', title: 'Weapon ownership, list management, and roster status', notes: [
    'Separated weapon ownership inside multi-profile units, renamed Missile Weapons to Range Weapons, atomized compound weapon descriptions, and added linked weapon-rule references.',
    'Improved mount ordering, mounted-only cleanup, Armoured Hide save effects, repeatable magic-item quantities, and owner-specific magic allowances.',
    'Added persistent list locking/copy/delete management, improved Back behavior, expanded equipment lines, removed war-machine armaments from model Equipped labels, and added explicit roster VALID/INVALID status.',
  ] },
  { version: '0.33–0.35', title: 'All-army roster validation and magic workflow', notes: [
    'Expanded live Builder/profile loading beyond the initial Orc & Goblin data and added composition validation, category limits, General requirements, list Settings, favorites, and lock groundwork.',
    'Added category point/requirement accounting, explicit unit-picker Add controls, dynamic General/Battle Standard Bearer roster roles, and broader profile hydration.',
    'Reworked magic-item filtering for owner permissions, Battle March/point restrictions, magical-weapon ordering, mixed-armament quantities, profile loadout lines, and initial upgrade-profile handling such as Big ’Uns.',
  ] },
  { version: '0.30–0.32', title: 'Data baseline, migration, and Builder integration', notes: [
    'Introduced versioned storage migration and explicit external-data baseline/status checks while removing dependence on older legacy storage keys.',
    'Expanded remote Old World Builder faction/magic-item loading with fallback handling and established the data-reference architecture later used by Army List profiles.',
    'Added the top-level battle summary with victory-point and attack-state information while retaining the complete tracked phase workflow.',
  ] },
  { version: '0.27–0.29', title: 'Round carry-forward and versioned battle state', notes: [
    'Expanded collapsed round history and automatic carry-forward for destroyed/fleeing units, banners, ranks, reserves, and other battlefield state.',
    'Formalized versioned battle-state storage/migration while preserving the complete Setup through Combat workflow.',
  ] },
  { version: '0.23–0.26', title: 'Shooting, casting, combat, and full phase workflow', notes: [
    'Expanded shooting To Hit/To Wound sequencing with range, cover, and skirmisher modifiers and added passive casting-item effects, casting modifiers, and rerolls.',
    'Expanded combat entries for joined characters, mounts, champions, initiative ordering, challenges, synchronized challenge damage, and overkill.',
    'Consolidated the full tracked phase workflow with charge tests/declarations, movement calculations, and stronger between-round state carry-forward.',
  ] },
  { version: '0.19–0.22', title: 'Imported armies and richer combat/profile UI', notes: [
    'Made imported friendly army data the source of truth for army totals, costs, model counts, and profiles and removed redundant friendly point-entry fields.',
    'Added richer profile/initiative/challenge/cast/item-use presentation and improved import-status feedback as imported-army integration stabilized.',
  ] },
  { version: '0.14–0.18', title: 'Scenario checks, import UI, and live round state', notes: [
    'Expanded challenge/overkill, initiative, defensive-profile, deployment/formation, and spell-resolution presentation.',
    'Added friendly-army paste/file import controls and scenario-specific start/deployment checks including Meeting Engagement reserve rolls.',
    'Formalized the main Setup/Overview/Deployment/Strategy/Movement/Shooting/Combat flow and expanded live round-state tracking for characters, casualties, reserves, banners, models remaining, and victory points.',
  ] },
  { version: '0.09–0.13', title: 'List import, scenarios, and persistent spell/challenge state', notes: [
    'Added opponent and friendly list import/storage groundwork, army list-type/battle format/scenario selection, and first-player setup.',
    'Expanded deployment/formation state plus persistent spell attempt/skip, target, casting/dispel, Miscast, Remains in Play, challenge profile, and overkill tracking.',
  ] },
  { version: '0.05–0.08', title: 'Battle-state presentation, defense, and round overview', notes: [
    'Refined Turn 1/later-round overview presentation and added calculated movement allowances, clearer must-charge handling, and reserve carry-forward.',
    'Added defense/save panels, incoming AP/adjusted armour/Ward Saves, weapon selection, command-casualty tracking, and broader charge/shooting/panic handling.',
  ] },
  { version: '0.01–0.04', title: 'Initial Old.dex battle tracker', notes: [
    'Established the fixed Orc & Goblin test force, initial unit profiles/weapons/special-rule references, and the core battle-phase shell.',
    'Expanded the prototype into a persistent phase/subphase tracker from deployment through End of Turn with movement, charges, shooting, combat, and break outcomes.',
    'Added rule-step validation for vortex/rally/Impetuous/charges/flee/movement plus casting, Miscast, targets, dispels, reserves, formations, casualties, banners, and combat-result resolution.',
  ] },
]
