export type ChangelogEntry = {
  version: string
  title: string
  notes: string[]
}

export const changelogEntries: ChangelogEntry[] = [
  { version: '0.51', title: 'Army-list rules, magic modes, and profile presentation', notes: [
    'Added pill presentation for every equipped weapon rule and explicit Special Rule/Magical Item type pills on rule cards.',
    'Recentered the approved characteristic artwork, standardized Army List action-icon geometry, rounded pill UI consistently, and completed a typography/spacing cleanup.',
    'Verified dynamic Ward Save and Regeneration behavior, corrected Regeneration override preservation, and retained Armoured Hide/mount armour interactions.',
    'Removed match-only Wilderness Terrain and Disruptive Weather composition choices; added Limit 1 Magic and Magical Maelstrom roster rules.',
    'Magical Maelstrom now makes active Wizards one level above their normal maximum at no Wizard-level upgrade cost and visibly marks them with its rule pill.',
    'Corrected Wizard level defaults, moved Frenzy upgrades into Special Rules & Upgrades, classified war-machine armaments as ranged weapons, and ordered profiles Unit, Champion, optional model, then mount.',
    'Improved magic-item removal, option cost presentation, roster validation UI, and generic option-prerequisite handling across Army List profiles.'
  ] },
  { version: '0.50', title: 'Army-list profile and option UI review', notes: [
    'Corrected Wizard starting-level normalization per Wizard owner and preserved independent Wizard upgrade groups.',
    'Added source-driven option prerequisites for Frenzy/Warpaint, crew-count choices, and mounted-only options, with invalid dependent choices removed automatically.',
    'Made Ward Save and Regeneration profile characteristics appear only while active and applied optional-mount rider Movement/characteristic effects reversibly.',
    'Reworked Equipment & Options ordering and standardized per-model add/remove controls while preserving Shields as unit-level checkboxes.',
    'Simplified magic-item selection to one selector, moved chosen items into dedicated rule-style cards, and removed magic items from Special Rules.',
    'Reviewed Army Lists, roster/list settings, delete mode, composition-option presentation, and Settings text-size layout for consistent UI behavior.'
  ] },
  { version: '0.49', title: 'Code architecture and loadout normalization', notes: [
    'Made Shields unit-level toggle selections while keeping selection scope independent from per-model pricing.',
    'Centralized loadout semantics so optional melee and ranged weapons appear in profile tables only when equipped, with Hand Weapon retained by default.',
    'Restricted per-model add/remove controls to explicitly normalized mixed-armament weapon choices instead of broad stackable/maximum inference.',
    'Consolidated rule helpers, persistence, runtime schemas, network/storage error handling, and data-only composition parsing.',
    'Removed the duplicated standalone preview implementation and reduced historical CSS override debt.',
    'Added ODX-CODE static analysis, rule/UI regression tests, strict checks, and clean-build CI support.'
  ] },
  { version: '0.48', title: 'Weapon loadout and mixed-armament controls', notes: [
    'Changed Melee Weapons and Range Weapons into equipped-only profile tables; unselected optional weapons no longer appear there.',
    'Moved mundane weapon choices into Equipment & Options, where normal choices use checkboxes and mixed-armament units use per-model add/remove controls instead.',
    'Made Hand Weapon a persistent equipped weapon for every model by default, while retaining an explicit data-level exception when a unit states otherwise.',
    'Corrected mixed-armament counting so universal Hand Weapons do not consume the allocation used by other weapon choices.'
  ] },
  { version: '0.47', title: 'Approved icon set integration', notes: [
    'Rebuilt all 14 supplied Old.dex icons directly from the approved two-row artwork sheet.',
    'Corrected Attacks to the double-headed axe, Special Rule to the starburst, Spell to the fireball, and Regeneration to the circular healing mark.',
    'Applied specific approved icons to rule-card tones where a clear match exists, using the Special Rule icon only as the fallback.',
    'Kept canonical unit-profile order as M, WS, BS, S, T, W, I, A, Ld, Sv, followed by conditional Wd and Rn.'
  ] },
  { version: '0.46', title: 'Selection-state rebuild', notes: [
    'Rebuilt Army List option-state handling so only included/default choices begin checked and locked; all other options remain unchecked and interactive.',
    'Fixed Wizard level persistence and exclusivity so one current Wizard Level X is stored and displayed at a time.',
    'Repaired melee and range weapon checkbox state handling and stopped saved defaults from being re-injected into displaced exclusive choices.',
    'Restored canonical characteristic order and centered dynamic profile rows as Ward Save and Regeneration appear or disappear.',
    'Hardened queued Select Unit completion so Done, close, and backdrop commit queued selections while Cancel discards them.'
  ] },
  { version: '0.45', title: 'Profile and selection-state correction', notes: [
    'Restored canonical characteristic order and added a dedicated axe icon for Attacks.',
    'Corrected Wizard-level defaults so only the starting level is selected/locked and only one current Wizard Level X label is shown.',
    'Repaired melee and range weapon checkbox interaction while preserving included/default weapon locking.',
    'Made Ward Save appear dynamically when gained and equalized Equipment & Options card sizing.',
    'Changed queued unit selection to commit on close and renamed the batch action to Done.'
  ] },
  { version: '0.44', title: 'Multi-add and option-state repair', notes: [
    'Added queued multi-select to Select Unit so several different units can be chosen and added to the roster in one operation.',
    'Reworked default/included choice normalization so included choices stay checked and locked while non-default choices stay unchecked and unlocked.',
    'Corrected persistent Hand Weapon behavior so a model keeps its included Hand Weapon when another weapon option is selected.',
    'Corrected Wizard-level exclusivity/default restoration while retaining a single current Wizard Level X roster/profile label.'
  ]},
  { version: '0.43', title: 'Builder option-state correction', notes: [
    'Corrected Army List option defaults so source-included choices are checked and locked while every non-default choice starts unchecked and unlocked.',
    'Corrected Wizard base-level behavior and collapsed Wizard level presentation to one current Wizard Level X label.',
    'Reworked melee/range weapon visibility so owner-specific weapons appear only with their owning model or upgrade.',
    'Reordered characteristic presentation to the supplied icon map and changed characteristic rows to recenter automatically as conditional saves are added or removed.'
  ]},
  { version: '0.42', title: 'Builder reliability and changelog', notes: [
    'Added the in-app Changelog page and header link with a collapsible history for every alpha build.',
    'Rebuilt characteristic icon assets from the supplied artwork and corrected Ward Save display so Wd only appears when a profile actually has a Ward Save.',
    'Corrected default versus optional weapon, equipment, mount, and Wizard-level selection behavior in Army List unit profiles.',
    'Removed Available Lores from Unit Details and stopped presenting available lore choices as if a Wizard had already selected one.',
    'Improved roster back navigation, unit-picker action icons, and added a Custom Data upload placeholder under Settings → Data & Content.'
  ]},
  { version: '0.41', title: 'Create List hotfix', notes: [
    'Fixed an asynchronous Create Army List state reset that could freeze or wipe selections after live composition data refreshed.',
    'Cleaned Settings section headings and normalized Settings text colors.',
    'Added the supplied Regeneration artwork to the characteristic icon set.'
  ]},
  { version: '0.40', title: 'Composition controls and profile icons', notes: [
    'Added characteristic icons to Army List model profiles and introduced Rn for Regeneration.',
    'Added Allow Allies, Allow Mercenaries, and Allow Custom Units composition options, including roster category visibility rules.',
    'Added named-character General enforcement and invalid roster-entry shading.',
    'Converted Add, View, Copy, and delete actions toward icon-based controls and improved roster navigation.'
  ]},
  { version: '0.39', title: 'Defaults, magic pools, and unit sizes', notes: [
    'Reorganized Settings and reduced the size of update/reset actions.',
    'Corrected default option interpretation and Wizard base-level handling against Builder metadata.',
    'Changed magic-item selection to owner panels and added the yellow valid-with-unspent-magic warning state.',
    'Stopped profile-page Unit Size text from overwriting Builder minimum/maximum model counts.'
  ]},
  { version: '0.38', title: 'List management and Wizard cleanup', notes: [
    'Deduplicated composition entries between Create List and roster Settings.',
    'Added list copy/delete management, persistent list locking, and improved Back behavior.',
    'Separated magic-item pools by eligible owner and tightened item-type restrictions.',
    'Expanded equipment lines dynamically and removed war machines from model Equipped labels.'
  ]},
  { version: '0.37', title: 'Weapon and profile presentation', notes: [
    'Atomized compound weapon descriptions, deduplicated identical weapons, and retained default Hand Weapons.',
    'Added linked common weapon-rule labels and See Rule links for unique weapon rules.',
    'Improved mount ordering and profile updates, including Armoured Hide save effects.',
    'Flattened points badges and related pill-style UI elements to better match the application.'
  ]},
  { version: '0.36', title: 'Weapon ownership and roster status', notes: [
    'Separated weapon ownership between models inside multi-profile units and renamed Missile Weapons to Range Weapons.',
    'Added mounted-only weapon cleanup when a required mount is removed.',
    'Improved repeatable magic-item quantity handling and owner-specific magic allowances.',
    'Added explicit VALID/INVALID roster coloring and the roster check/cross indicator.'
  ]},
  { version: '0.35', title: 'General, BSB, and magic-item workflow', notes: [
    'Restored General as a character role and introduced dynamic General/Battle Standard Bearer roster sections.',
    'Reworked magic-item filtering for owner permissions, Battle March items, and list point restrictions.',
    'Added separate profile loadout lines and initial profile-upgrade handling such as Big ’Uns.'
  ]},
  { version: '0.34', title: 'Roster role and category accounting', notes: [
    'Introduced the first General roster-category experiment and shared Character allowance accounting.',
    'Added category budget/requirement readouts and explicit Add controls in the unit picker.',
    'Improved characteristic/profile hydration across army datasets.'
  ]},
  { version: '0.33', title: 'Roster validation and all-army data pass', notes: [
    'Added roster composition validation, category limits, General requirements, and broader army-specific checks.',
    'Added list Settings, composition-option labels, persistent favorites, and list-lock groundwork.',
    'Moved magical weapons to the top of weapon lists and added mixed-armament quantity handling.',
    'Expanded live Builder/profile loading beyond the initial Orc & Goblin implementation.'
  ]},
  { version: '0.32', title: 'Remote Builder integration milestone', notes: [
    'Added a top-level battle summary with victory-point and attack-state information.',
    'Expanded Old World Builder remote JSON loading and fallback handling for faction and magic-item data.',
    'Established the data-reference architecture used by later Army List profile work.'
  ]},
  { version: '0.31', title: 'Reference-data maintenance', notes: [
    'Continued the data-baseline/status architecture and full battle workflow.',
    'Removed dependence on older legacy storage keys as the tracked data model stabilized.'
  ]},
  { version: '0.30', title: 'Data baseline and migration', notes: [
    'Introduced a versioned v0.30 storage key with migration support for v0.29/v0.28 data.',
    'Added explicit data-baseline/status checking for external rules and Builder content.'
  ]},
  { version: '0.29', title: 'Versioned battle-state storage', notes: [
    'Formalized the v0.29 storage key and migration from the previous stored battle state.',
    'Retained the complete Setup through Combat workflow while preparing the next data-integration stage.'
  ]},
  { version: '0.28', title: 'Workflow maintenance', notes: [
    'Maintenance iteration on the v0.27 phase workflow and state-storage model.',
    'No separate player-facing milestone is preserved in the surviving project notes for this build.'
  ]},
  { version: '0.27', title: 'Round history and carry-forward', notes: [
    'Expanded collapsed round history and automatic carry-forward of destroyed/fleeing units, banners, ranks, and reserves.',
    'Retained the full Setup, Strategy, Movement, Shooting, and Combat sequence.'
  ]},
  { version: '0.26', title: 'Battle workflow maintenance', notes: [
    'Maintenance iteration on the v0.25 full-phase workflow and versioned saved battle state.',
    'No distinct player-facing milestone is preserved in the surviving project notes for this build.'
  ]},
  { version: '0.25', title: 'Full tracked battle workflow', notes: [
    'Consolidated the complete phase workflow with explicit charge tests/declarations and movement calculations.',
    'Expanded battle-state carry-forward between rounds.'
  ]},
  { version: '0.24', title: 'Combat model expansion', notes: [
    'Expanded combat attack entries for joined characters, mounts, champions, initiative ordering, and challenges.',
    'Improved challenge damage synchronization and overkill handling.'
  ]},
  { version: '0.23', title: 'Shooting and casting modifiers', notes: [
    'Expanded shooting To Hit/To Wound sequencing and long-range, cover, and skirmisher modifiers.',
    'Added passive casting-item effects plus casting-roll modifiers and rerolls.'
  ]},
  { version: '0.22', title: 'Combat workflow maintenance', notes: [
    'Maintenance iteration bridging the richer profile/combat UI into the expanded shooting and item-effect work.',
    'No distinct player-facing milestone is preserved in the surviving project notes for this build.'
  ]},
  { version: '0.21', title: 'Profile and combat UI expansion', notes: [
    'Added richer profile presentation, initiative badges, challenge/overkill UI, cast boxes, and item-use cards.',
    'Improved import-status feedback throughout the battle setup workflow.'
  ]},
  { version: '0.20', title: 'Imported-army integration maintenance', notes: [
    'Maintenance iteration following the switch to imported friendly-list data as the battle source of truth.',
    'No distinct player-facing milestone is preserved in the surviving project notes for this build.'
  ]},
  { version: '0.19', title: 'Imported list becomes source of truth', notes: [
    'Friendly army import became the source of truth for army totals, unit costs, model counts, and profiles.',
    'Removed separate friendly point-entry fields and added opponent-points display.'
  ]},
  { version: '0.18', title: 'Live army state and round history', notes: [
    'Expanded the overview to track joined characters, destroyed/fled units, reserves, banners, models remaining, and victory points.',
    'Added round-history state and a dedicated test-battle reset path.'
  ]},
  { version: '0.17', title: 'Phase workflow formalization', notes: [
    'Formalized Setup, Overview, Deployment, Strategy, Movement, Shooting, and Combat as the main application flow.',
    'Expanded automatic carry-forward of battlefield state between rounds.'
  ]},
  { version: '0.16', title: 'Friendly list import UI', notes: [
    'Added friendly-army paste/file import and storage controls.',
    'Kept the internal test force as battle data while import parsing was being connected.'
  ]},
  { version: '0.15', title: 'Scenario start checks', notes: [
    'Added scenario-specific deployment/start checks, including Meeting Engagement reserve rolls.',
    'Added required start-of-turn checks to the phase workflow.'
  ]},
  { version: '0.14', title: 'Challenge and defense presentation', notes: [
    'Expanded challenge/overkill, initiative, profile, and defensive-profile UI.',
    'Continued the detailed spellcasting and combat-resolution workflow.'
  ]},
  { version: '0.13', title: 'Deployment and formation expansion', notes: [
    'Expanded deployment/formation tracking and scenario-specific battle state.',
    'Continued saved-army and opponent-import setup architecture.'
  ]},
  { version: '0.12', title: 'Persistent spell and challenge state', notes: [
    'Expanded spell attempt/skip, target, casting/dispel, Miscast, and Remains in Play handling.',
    'Improved challenge opponent-profile and overkill tracking.'
  ]},
  { version: '0.11', title: 'Friendly import groundwork', notes: [
    'Added friendly-list import/storage scaffolding alongside the existing opponent import.',
    'Expanded the magic-phase workflow while the internal test force remained the battle-data source.'
  ]},
  { version: '0.10', title: 'Battle setup and import expansion', notes: [
    'Expanded stored/lightly parsed list imports and added army list-type selection.',
    'Connected setup to the complete deployment, strategy, movement, shooting, and combat workflow.'
  ]},
  { version: '0.09', title: 'Opponent import groundwork', notes: [
    'Added opponent list paste/file import with stored, light parsing.',
    'Added battle format/scenario selection and first-player setup.'
  ]},
  { version: '0.08', title: 'Round overview and reserves', notes: [
    'Added a clean Round 1 overview and automatic read-only carry-forward summaries after later rounds.',
    'Moved unresolved reserve entry into Compulsory Moves after deployment.'
  ]},
  { version: '0.07', title: 'Command casualties and defensive saves', notes: [
    'Added constrained standard bearer, musician, and champion casualty tracking.',
    'Expanded defensive profiles with incoming AP, adjusted armour saves, and Ward Saves.'
  ]},
  { version: '0.06', title: 'Defense and command controls', notes: [
    'Added defense/save panels, weapon selection, command-casualty tracking, and responsive save layouts.',
    'Expanded charge, reserve, shooting, and panic handling.'
  ]},
  { version: '0.05', title: 'Battle-state presentation pass', notes: [
    'Refined Turn 1 overview and later read-only summaries.',
    'Added calculated movement allowances and clearer must-charge handling.'
  ]},
  { version: '0.04', title: 'Granular phase resolution', notes: [
    'Expanded deployment, strategy, movement, shooting, and combat into detailed validated sub-steps.',
    'Added reserve handling, formation/frontage state, spell targets/dispels, casualties, banners, and combat-result caps.'
  ]},
  { version: '0.03', title: 'Rules-step validation', notes: [
    'Added validation for vortex movement, rally, Impetuous checks, charge resolution, compulsory flee, and remaining moves.',
    'Added casting dice, Miscast, spell-target, and dispel-resolution checks.'
  ]},
  { version: '0.02', title: 'Battle tracker foundation', notes: [
    'Expanded the prototype into a phase/subphase battle tracker covering deployment through End of Turn.',
    'Added persistent state for movement, charges, shooting, combat, and break outcomes.'
  ]},
  { version: '0.01', title: 'Initial Old.dex prototype', notes: [
    'Established the first fixed Orc & Goblin test force and the core battle-phase shell.',
    'Added initial unit profiles, weapons, and special-rule references used to validate the interaction model.'
  ]},
]
