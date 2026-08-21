# Old.dex Changelog

## Alpha Build 0.65 — Interaction standards and turn-context battle guidance

- Standardized non-editable interaction surfaces across Old.dex so buttons, labels, selection cards, and other controls no longer present a stray text-entry caret; real text/number fields retain normal editing behavior and consistent focus treatment.
- Rebuilt the Magical Item picker interaction row around explicit checkbox/label and details-button controls instead of using the entire text row as an ad-hoc click target, keeping the same behavior for every army/model that uses the shared picker.
- Added a view-only Your Turn / Enemy's Turn context selector to Strategy, Movement, Shooting, Combat, and End-of-Round phases and all of their subphases.
- Added phase/subphase rule guidance that reads the friendly roster's canonical rule documents once, caches them, and filters them to the current step and turn context; Enemy's Turn focuses on friendly reactions, opponent-turn triggers, and shared combat/break interactions.
- Replaced automatic end-of-turn side switching with explicit Back, Your Turn, Enemy's Turn, and End of Round controls. Starting either turn returns to Strategy → Start of Turn without incrementing the round; End of Round records one completed round and returns to Start of Round until the configured round limit is reached.

## Alpha Build 0.64 — Match validation, deployment guidance, and Start of Round rules

- Changed Wizard spell-lore selection to a single-choice state and added a rider-profile safeguard so mount-granted Wound bonuses are applied to the character exactly once.
- Added a conditional Start New Match roster-check panel that flags invalid/warning rosters, over-limit rosters, and mismatched friendly/enemy point allowances before the match is created.
- Moved match round-count configuration into Setup Step 1, persisted custom game length independently of scenario defaults, and simplified the pre-battle Overview by removing the editable current-round and rounds-completed controls.
- Rebuilt Deployment Step 2 around the friendly roster only, showing each unit’s legal formation rules, deployment-specific rules, and a saved Reserve state when the unit or scenario permits it.
- Added dynamic deployment-rule reading so army-specific deployment mechanics can be discovered from their canonical rule pages rather than relying only on a fixed Vanguard/Scouts/Ambushers list.
- Expanded Start of Round into a rules-guidance phase that checks friendly and enemy roster special rules plus scenario, battlefield, battle-composition, and army-composition sources for effects that explicitly resolve at the start of a round.

## Alpha Build 0.63 — Old World Builder data-resolver rebuild and live source languages

- Rebuilt Old.dex data identity around Old World Builder’s own rules-index-export, additional rule mappings, synonym table, and name-normalization logic instead of relying on guessed slugs as the primary resolver.
- Moved unit and mount characteristic profiles to Old World Builder’s indexed stats first, with TOW page parsing retained only as secondary enrichment for metadata and full rule text.
- Made weapon and special-rule paths resolve through the canonical Old World Builder map before TOW fetching, while retaining the existing incomplete-transport safeguards for pages whose browser-visible content is richer than the fetched HTML.
- Replaced naive comma splitting in source rule/equipment interpretation with resolver-aware parsing so canonical names containing punctuation are preserved while compound source selections still separate correctly.
- Expanded mount enrichment so a selected mount can inherit indexed profile data and referenced source-unit rules/equipment when those details are stored on the standalone model rather than repeated on the parent character option.
- Added a whole-army resolver audit service that can enumerate unresolved units, mounts, weapons, and rules and report a resolution rate for future data-integrity regression checks.
- Activated footer language preferences for live Builder-source data by reading the same localized name fields used by Old World Builder and reloading roster-builder, model-profile, and roster-view data when the language changes.

## Alpha Build 0.62 — Installable app, source-rule cleanup, and guided match setup

- Added Progressive Web App installation support for phones, tablets, and desktop browsers, using the supplied Old.dex artwork for browser, home-screen, and installed-app icons.
- Tightened the Support action buttons, stabilized roster-list controls by moving import status into the fixed left summary area, and rebuilt delete-selection rows so roster names and labels remain compact instead of collapsing into oversized cards.
- Reworked special-rule text extraction to split flattened source pages into individual sentences, reject source/update metadata and flavour-only sentences, retry incomplete rule pages, and require mechanical language before fallback text can appear. This addresses cases such as Fear of Elves without creating a rule-specific exception.
- Changed the Magical Item picker to hide items that cannot currently be afforded while keeping already-selected items visible for removal.
- Snapshotted friendly and enemy roster/composition details into new matches so Setup and Overview remain stable even if the saved roster changes later.
- Expanded Setup with friendly/enemy roster details plus a friendly Wizard/Priest list, match-only lore selection where source options allow it, and a second step for recording generated Wizard spells or reviewing available prayers.
- Added contextual Tips to both Setup steps and the initial Overview, including spell-generation guidance and direct access to the relevant rules reference, and replaced the bare Overview with an at-a-glance battle dashboard for matchup, scenario, score state, prepared magic, and battle-flow progress.

## Alpha Build 0.61 — Read-only enemy rosters, local data controls, and authoritative weapon references

- Made rosters flagged as Enemy Army Rosters view-only: normal navigation opens the roster overview, direct Builder/profile edit routes are locked, and enemy rows no longer expose Copy or Export actions until the roster is moved back to the friendly list.
- Corrected the Support action dimensions and aligned the Games title, Start New Match, Open Matches, and Match History panels to the same page column width.
- Increased green/red/yellow roster-state tint and border contrast so valid, invalid, and warning roster states remain visible in both light and dark themes.
- Added separate Settings controls to clear ongoing matches, completed match history, friendly rosters, or enemy rosters without requiring a full local-data reset.
- Reworked weapon-reference ingestion around the canonical tow.whfb.app Weapons of War page: incomplete cached pages are retried live, weapon self-names and reference-table links are rejected as pseudo-rules, and Notes links are promoted only when they actually target Special Rules.
- Added a canonical weapon-page fallback for Grand Cannon when the transport-safe source returns an empty Special Rules cell, restoring Armour Bane (3), Cannon Fire, Cumbersome, Move or Shoot, Multiple Wounds (D3+1), and Thunderous Impact while keeping the Black Powder Misfire table in Notes rather than the Special Rules column.

## Alpha Build 0.60 — Match setup, enemy rosters, support actions, and rule-detail reliability

- Replaced the Support links with the production one-time and recurring Stripe URLs and presented both as centered side-by-side buttons below the support disclaimer.
- Simplified Games filtering to icon-driven filter menus while retaining search, three-item default lists, and match metadata filtering.
- Reworked Start New Match around Friendly General and Enemy General panels, each with an always-available general-name field plus roster selection/import controls.
- Added friendly-roster battle composition details beneath the scenario information and reversed the Create Match / Cancel action order.
- Replaced Army Roster View and Export text actions with icon actions and added an Enemy Roster flag that moves flagged rosters into a separate Enemy Army Rosters group.
- Preserved enemy-roster status through native JSON export/import and list duplication.
- Improved magical-item selection descriptions with background detail loading and stronger fallback extraction while keeping unaffordable legal items visible and greyed out.
- Added a second rule-card detail fallback so special-rule and magical-item cards can recover readable information when the primary rules-index extraction returns no summary.
- Reworked unit-profile loading so the base Builder profile renders immediately while special rules, weapon details, and optional profile references continue enriching in the background, eliminating the previous all-or-nothing profile wait.

## Alpha Build 0.59 — Roster workflow, match tools, and rules-profile polish

- Made image-backed text panels more transparent with a light backdrop blur, removed Background panel divider borders, and replaced Donations with explicit one-time and recurring Support actions.
- Expanded Games with compact three-item defaults, filters and search across match names, rosters, factions and points, and aligned the Games content width with the rest of Old.dex.
- Reworked Start New Match so both players can select or import rosters, replaced premature first-player selection with scenario information, and moved first-turn recording into the Deployment workflow.
- Added actual-versus-limit roster totals, green/yellow/red roster state tinting, native JSON export, and a read-only roster overview with unit loadouts, rules and profile tables.
- Repaired magical-item picker layout and preserved imported Old World Builder magical-item selections and points where the JSON contains them.
- Expanded Wizards & Magic with source lore/magic choices, removed redundant enforced-choice notes, centered model-count controls, widened the roster total display, and normalized counted Hand Weapon labels.
- Improved weapon rule ingestion so linked mechanical Notes such as firing and misfire procedures are surfaced with the weapon profile site-wide, and removed unresolved rule-text placeholder copy.
- Contained Select Units action dividers so Add/View controls render cleanly and disabled the unfinished Custom Units battle option until it has functional data support.

## Alpha Build 0.58 — Interface readability, JSON imports, and weapon-data integrity

- Restored the original site-wide interface text scale while keeping the larger OLD.DEX, ALPHA BUILD, and Changelog header treatment isolated to the header.
- Added theme-colored back panels for exposed text when a custom background image is active and corrected Settings text contrast in dark faction themes.
- Repaired the Select Units modal so rows retain readable height/columns instead of being compressed, and centered/colored the Create List Cancel action red.
- Kept selected Battle Composition option details permanently expanded with larger default text.
- Properly capitalized Magical Lore names, changed spell-lore phase labeling to Winds of Magic, and added Spell Lore: <Lore> keywords to selected lore rule cards.
- Enabled JSON army-list import from Army Lists, active list-building, and Start New Match, including native Old.dex data plus Old World Builder .owb.json/.owb.lists.json files.
- Fixed nested source-option selection IDs so dependent choices such as nested weapon upgrades are exposed consistently across armies, and expanded ranged-weapon recognition to bombs/grenades.
- Merged source-specific weapon special rules with shared weapon-reference rules instead of overwriting one source with the other.


This is the canonical duplicate-free project history. The in-app Changelog mirrors these same entries. Repeated correction passes are consolidated into the build or build range where the behavior became part of the application source.

## Alpha Build 0.57 — Magic selection, composition options, display polish, and Games groundwork

- Refined roster percentage presentation so only the current percentage is status-coloured, zero-percent rows remain neutral, VALID/INVALID badges are centered, and Army List popouts/text-size controls fit their available space more reliably.
- Increased OLD.DEX/build/Changelog readability, deepened all light faction themes, improved Legions of Undead contrast, corrected dark-theme highlight text/icon contrast, and added four fixed user-selectable site background images.
- Added multi-category unit-picker tabs that preserve selections while moving between categories, an Over - Under option allowing a yellow-valid +10 point tolerance, and Monster Mash support for one eligible non-character Monstrous Creature, War Machine, or Chariot to count as Core.
- Added expandable Battle Composition option explanations and a Cancel action to list creation.
- Reworked Wizard Level into Wizard & Spell Lores, persisted selected spell/prayer lores into roster profiles, surfaced selected lores and source spell-like abilities as Special Rule cards, and retained magical-item fluff where available.
- Replaced the inline magical-item selector with a staged popup containing item-type tabs, live allowance accounting, unaffordable-item disabling, expandable descriptions, Finish-to-commit behavior, and X/Cancel discard behavior.
- Started the Games section with Start New Match, Open Matches, Match History, saved-list based match creation, and a persistent Setup/Overview/Deployment/Strategy/Movement/Shooting/Combat/End phase-step workflow based on the prepared Old World Battle groundwork.

## Alpha Build 0.56 — Roster status, current General, local-data reset, and faction themes

- Removed the stray divider above Army Validation issues and normalized Melee/Range special-rule pills to the same centered, regular-weight pill treatment used elsewhere.
- Added requirement-aware red/yellow/green status coloring to category percentages: minimum requirements progress from red to yellow to green, while maximum allowances progress from green to yellow to red as the limit is approached.
- Moved each roster unit/model point total into a centered rectangular badge above Edit/View/Copy/Remove controls and added a light (Current) marker after the roster model already assigned as General.
- Added a Reset local data action that clears saved lists, favorites, cached content, and other locally added Old.dex data while preserving Display settings.
- Replaced the Themes placeholder with collapsible Forces of Fantasy, Powers of Chaos, Legions of Undead, and Ravening Hordes theme switches, with dedicated light and dark palettes so Dark mode remains fully compatible.

## Alpha Build 0.55 — Roster totals, profile sizing, weapon AP, and publication completeness

- Removed percentages from the top roster point total while keeping category percentages as rounded whole numbers and preserving the selected/points/allowance percentage format within category summaries.
- Moved unit-size information beneath the profile points badge, placed model add/remove controls directly beneath the current model count, and removed the duplicate Unit Size field from Unit Details.
- Changed selected Magical Item cards to true two-column grid rows, centered melee/range weapon table content, reserved more width for Special Rule pills, and added conditional AP presentation for profile-level AP improvements such as Choppas and Armour Bane.
- Added contextual General labels that identify the other roster model currently selected as General, guaranteed a list-publication fallback for every live unit, and added spacing above roster validation issue rows.

## Alpha Build 0.54 — Rule-card links, settings hierarchy, and roster category accounting

- Capitalized special-rule callout keyword pills and linked Special Rule/Magical Item type pills directly to their underlying rule or item pages when available.
- Matched selected Magical Item cards to the same responsive two-column card flow used by Special Rules while retaining their attached owner, points, quantity, and removal controls.
- Reordered Settings so reporting appears first, moved reset controls and a Themes placeholder into Display, removed the separate Local section, and placed Donations immediately above Data & Content.
- Improved OLD.DEX/build/Changelog header spacing and changed roster category summaries to show selected count, points, allowance/requirement remaining, and current-versus-target percentages in one line.
- Renamed Composition Rule to Battle Composition and Composition Options to Battle Composition Options throughout list creation and list settings.

## Alpha Build 0.53 — Profile semantics, roster presentation, and project-history reconciliation

- Cleaned Magical Item and Army validation presentation, neutralized Special Rule/Magical Item type keywords, and centered the profile favorite control.
- Added Magical Attacks to profile keywords whenever an equipped magical weapon grants magical attacks, and split sentence-like special-rule parenthetical callouts into their own linked keyword pills.
- Changed mount Armour Save display to show the armour bonus contributed to the rider (for example +1 from Armoured Hide) or — when the mount contributes no armour bonus.
- Changed upgraded profile presentation so explicit upgrade profiles such as Big ’Uns replace the ordinary model profile instead of displaying both versions together.
- Renamed magic/composition options for clarity, added roster point percentages beside point totals/requirements/allowances, and added Settings placeholders for bug reporting and donations.
- Added the application-wide work-in-progress banner, increased the OLD.DEX header wordmark, and reconciled the in-app and GitHub changelogs into one duplicate-free canonical history.

## Alpha Build 0.52 — Army-list rules, dynamic profiles, points, and expanded icons

- Added Magical Category limiting and Magical Maelstrom composition behavior, including free maximum-plus-one Wizard levels and roster-wide category validation.
- Completed dynamic Ward Save, Regeneration, Armoured Hide, mount/rider characteristic, Wizard-level, magic-item, and war-machine weapon presentation in unit profiles.
- Unified unit point calculation across the picker, default roster entries, edited units, magic items, per-model equipment, and mixed-model weapon allocations.
- Added dedicated pill links for equipped weapon rules, moved Special Rule/Magical Item type markers into rule-card keyword footers, and standardized Army List typography, icons, pills, and validation UI.
- Removed match-only terrain/weather choices from list composition, stabilized dynamic-profile scrolling, fixed roster Edit autosave freezing, and expanded the icon pack with six spell-category icons.

## Alpha Build 0.50 — Source architecture, loadouts, and option normalization

- Made the Vue/TypeScript application the only implementation source, converted standalone preview output into a generated review artifact, and added ODX-CODE static analysis/regression coverage.
- Centralized loadout, persistence, schema, composition, network/storage, error-handling, and rule-helper behavior while reducing duplicate preview/CSS architecture.
- Finalized equipped-only melee/range tables, persistent Hand Weapon behavior, unit-level Shield selection, and explicit per-model mixed-armament allocation.
- Normalized Wizard starting levels, option prerequisites, Equipment & Options ordering, magic-item selection/removal, mount movement/bonuses, and dynamic Ward/Regeneration behavior across applicable units.

## Alpha Build 0.48 — Approved icons and equipped-weapon presentation

- Rebuilt the supplied characteristic/rule icon set from the approved artwork, including Attacks, Ward Save, Special Rule, Spell, and Regeneration corrections.
- Applied specific rule-category icons where available and retained the generic Special Rule icon only as a fallback.
- Changed melee/range profile tables to show only equipped weapons and moved optional weapon choices into Equipment & Options, with mixed-armament quantity controls where source rules require them.

## Alpha Build 0.46 — Builder selection-state stabilization

- Added the in-app Changelog and corrected source-included versus optional weapon/equipment/mount selections so defaults remain selected/locked and alternatives remain interactive.
- Stabilized Wizard level exclusivity and persistence so each Wizard displays one current level rather than multiple simultaneous defaults.
- Corrected owner-specific weapon/profile visibility, dynamic Ward Save rows, characteristic ordering/recentering, and queued multi-unit selection completion.
- Removed Available Lores from Unit Details when they represented choices rather than selected lores, and added the Custom Data Settings placeholder.

## Alpha Build 0.41 — Composition controls, profile icons, and Create List reliability

- Added characteristic icons and Regeneration to Army List profiles, composition options for Allies/Mercenaries/Custom Units, named-character General enforcement, and invalid-entry highlighting.
- Reorganized Settings, corrected Builder default/Wizard metadata handling, separated magic-item allowances by owner, and preserved Builder unit-size bounds.
- Fixed asynchronous Create List refresh state that could wipe selections or freeze the page while live composition data loaded.

## Alpha Build 0.38 — Weapon ownership, list management, and roster status

- Separated weapon ownership inside multi-profile units, renamed Missile Weapons to Range Weapons, atomized compound weapon descriptions, and added linked weapon-rule references.
- Improved mount ordering, mounted-only cleanup, Armoured Hide save effects, repeatable magic-item quantities, and owner-specific magic allowances.
- Added persistent list locking/copy/delete management, improved Back behavior, expanded equipment lines, removed war-machine armaments from model Equipped labels, and added explicit roster VALID/INVALID status.

## Alpha Build 0.35 — All-army roster validation and magic workflow

- Expanded live Builder/profile loading beyond the initial Orc & Goblin data and added composition validation, category limits, General requirements, list Settings, favorites, and lock groundwork.
- Added category point/requirement accounting, explicit unit-picker Add controls, dynamic General/Battle Standard Bearer roster roles, and broader profile hydration.
- Reworked magic-item filtering for owner permissions, Battle March/point restrictions, magical-weapon ordering, mixed-armament quantities, profile loadout lines, and initial upgrade-profile handling such as Big ’Uns.

## Alpha Build 0.32 — Data baseline, migration, and Builder integration

- Introduced versioned storage migration and explicit external-data baseline/status checks while removing dependence on older legacy storage keys.
- Expanded remote Old World Builder faction/magic-item loading with fallback handling and established the data-reference architecture later used by Army List profiles.
- Added the top-level battle summary with victory-point and attack-state information while retaining the complete tracked phase workflow.

## Alpha Build 0.29 — Round carry-forward and versioned battle state

- Expanded collapsed round history and automatic carry-forward for destroyed/fleeing units, banners, ranks, reserves, and other battlefield state.
- Formalized versioned battle-state storage/migration while preserving the complete Setup through Combat workflow.

## Alpha Build 0.26 — Shooting, casting, combat, and full phase workflow

- Expanded shooting To Hit/To Wound sequencing with range, cover, and skirmisher modifiers and added passive casting-item effects, casting modifiers, and rerolls.
- Expanded combat entries for joined characters, mounts, champions, initiative ordering, challenges, synchronized challenge damage, and overkill.
- Consolidated the full tracked phase workflow with charge tests/declarations, movement calculations, and stronger between-round state carry-forward.

## Alpha Build 0.22 — Imported armies and richer combat/profile UI

- Made imported friendly army data the source of truth for army totals, costs, model counts, and profiles and removed redundant friendly point-entry fields.
- Added richer profile/initiative/challenge/cast/item-use presentation and improved import-status feedback as imported-army integration stabilized.

## Alpha Build 0.18 — Scenario checks, import UI, and live round state

- Expanded challenge/overkill, initiative, defensive-profile, deployment/formation, and spell-resolution presentation.
- Added friendly-army paste/file import controls and scenario-specific start/deployment checks including Meeting Engagement reserve rolls.
- Formalized the main Setup/Overview/Deployment/Strategy/Movement/Shooting/Combat flow and expanded live round-state tracking for characters, casualties, reserves, banners, models remaining, and victory points.

## Alpha Build 0.13 — List import, scenarios, and persistent spell/challenge state

- Added opponent and friendly list import/storage groundwork, army list-type/battle format/scenario selection, and first-player setup.
- Expanded deployment/formation state plus persistent spell attempt/skip, target, casting/dispel, Miscast, Remains in Play, challenge profile, and overkill tracking.

## Alpha Build 0.08 — Battle-state presentation, defense, and round overview

- Refined Turn 1/later-round overview presentation and added calculated movement allowances, clearer must-charge handling, and reserve carry-forward.
- Added defense/save panels, incoming AP/adjusted armour/Ward Saves, weapon selection, command-casualty tracking, and broader charge/shooting/panic handling.

## Alpha Build 0.04 — Initial Old.dex battle tracker

- Established the fixed Orc & Goblin test force, initial unit profiles/weapons/special-rule references, and the core battle-phase shell.
- Expanded the prototype into a persistent phase/subphase tracker from deployment through End of Turn with movement, charges, shooting, combat, and break outcomes.
- Added rule-step validation for vortex/rally/Impetuous/charges/flee/movement plus casting, Miscast, targets, dispels, reserves, formations, casualties, banners, and combat-result resolution.
