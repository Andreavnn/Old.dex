# Old.dex Changelog

Canonical release history mirrored from `src/data/changelog.ts`.

## Alpha Build 0.52 — Match references, export, score entry, and roster recovery

- Reordered Display and Data & Content settings into their requested menu sequence.
- Added working Match Reference Sheet and Battle Charts pages to the General's Bar; the supplied PDF is embedded without spell pages 21–24.
- Replaced the Match Share placeholder with Export options for a complete `.json` snapshot or compressed Match Share Code.
- Added a clear Back to Match control on Match Roster.
- Hardened Deployment Step 2 ordering so War Machine troop types are recognized from canonical troop type data and imported-roster keyword fallbacks.
- Removed the Total Power casting control, removed Charge Declared, and renamed Successful to Successful Charge.
- Moved Pursued Off-Table into the follow-up result grid and removed the redundant additional-result sentence.
- Added per-player round score inputs with persistent running totals.
- Fixed Army Rosters failing to display saved/imported rosters by loading storage when the page mounts.
- Added Jay's Wargaming to Special Thanks and updated build/cache metadata to Alpha Build 0.52.

## Alpha Build 0.51 — Unified Match navigation, General tools, roster state, and rules tracking

- Added News before Army Rosters in the primary navigation and removed duplicate small page-title labels from Army Rosters, Games, and Settings.
- Combined Match phase/subphase navigation and added the General’s Bar with a live Round Tracker and functional Roster tool.
- Added persistent Match Roster wounds/models-destroyed tracking against the same match state used by phase tools.
- Added roster switching, enemy-turn dispel guidance, Stand & Shoot resolution, Move or Shoot locking, Impact Hits, Pursued Off-Table and We Aren’t Paid to Fight tracking.
- Added Parry to qualifying Regular/Heavy Infantry rules and armour calculation.
- Added numbered spell generation, additional-spell item allowances, Scrolls of Wei-jin turn casting limits, and stronger magical-item collection fallbacks.
- Locked and unlocked roster View actions now use the same roster view.
- Updated Alpha Build metadata to 0.51.

## Alpha Build 0.50 — Repository deep clean, architecture compliance, and validation hardening

- Moved every Dropbox request behind the shared HTTP timeout/error boundary and removed the remaining explicit any response parsing from Cloud Sync.
- Removed the nonexistent bundled OWB catalog precache/fallback contract. OWB refresh remains authoritative and the last successful catalog remains persisted locally; service-worker core precache now contains only real assets.
- Removed obsolete standalone-review scripts, the unused BootAudioSetting and SegmentTabs components, and the placeholder ArmyView route; direct unit views now fall back to Army Rosters.
- Consolidated runtime CSS back into src/styles.css, removed the obsolete broad Dark Mode pill override, and expanded static analysis to measure the complete runtime stylesheet and validate service-worker core assets.
- Added repository hygiene through .gitignore and strengthened static analysis against obsolete/dead runtime files and split stylesheet drift.
- Replaced the placeholder Report control with a real GitHub issue workflow prefilled with build, page, browser, and recent local diagnostics.
- Centralized the public runtime build number and documented the separate saved-roster export schema version so app-version and file-format version cannot be confused.
- Reunified Alpha 0.43 through current release history into the canonical changelog and removed the recent-changelog sidecar.
- Moved match charge/use-limit and magical-profile mechanics back into their canonical owning services so compatibility facades remain thin.
- Extended maintenance regressions and repository validation for networking, service-worker assets, stylesheet consolidation, routing, changelog integrity, and dead-file cleanup.

## Alpha Build 0.49 — Match deployment, charge, profile, shooting, and score stability

- Corrected Deployment Step 2 so each War Machine roster entry keeps its own deployed/reserve state instead of one War Machine checkbox toggling every War Machine in the army.
- Removed the Miscast table heading row from selectable outcomes by hardening the shared random-table parser to reject D6/2D6 Result header rows.
- Renamed the voluntary Declare Charges state from Hold to Stay without changing the rules-defined Hold charge reaction elsewhere, highlighted MUST CHARGE IF POSSIBLE, removed filler charge copy, and added the live Charge Roll modifier chain such as Charge Roll > +D6 > +D3.
- Deduplicated joined Character and host-unit charge/reaction rules by canonical visible rule identity so the same Special Rule is not repeated when both models have it.
- Hardened match weapon hydration for source-linked and older roster snapshots so selected Warbows and other missile/melee upgrades are retained in Shooting and match unit profiles even when their source parent selection or historic count fields differ.
- Match roster profiles now display the quantity represented by each profile row, including champion/special model counts and one mount per mounted model where appropriate.
- Corrected canonical rider-versus-mount profile identity so profiles such as Boar Boy remain rider/unit profiles while War Boar remains a mount; rider-targeted persistent effects now apply to the correct profile.
- Allowed failed/transient match profile hydration to retry instead of permanently caching an unavailable profile for the rest of the screen session.
- Rebuilt End of Round score/action geometry with dedicated responsive columns so the score and four round controls no longer overlap.
- Reviewed the Match source path against the canonical architecture and retained Warbow classification in the core missile-weapon vocabulary; the missing-shooter failure was traced to roster-selection hydration rather than weapon classification.
- Bumped package, header, footer, Settings changelog label, Share Code metadata, and PWA cache metadata to Alpha Build 0.49.

## Alpha Build 0.48 — Locked-roster routing and match layout corrections

- Locked saved rosters now open directly in the Army Builder in locked/read-only state instead of routing through the separate roster overview page, including View actions reached from the Builder.
- Moved Ongoing Battle Conditions immediately below the current Tip panel and corrected their width containment so the shared condition panel cannot overhang match-step edges.
- Disconnected spell-column heights during Total Power and Miscast resolution so an expanded Miscast table no longer stretches neighboring spell entries.
- Expanded Combat Step 1 profile navigation to the entire unit information area while keeping the completion checkbox as an independent click target.
- Centered the Create Army Roster Cancel label and the Settings Changelog Open label inside their buttons.
- Changed the Display Text Size detail to “Adjust standard interface and rules-reader text.”
- Renamed the primary Army Lists navigation label to Army Rosters.
- Retained the scenario-aware minimum-round default introduced in Alpha 0.47.
- Bumped package, header, footer, Settings changelog label, Share Code metadata, and PWA cache metadata to Alpha Build 0.48.

## Alpha Build 0.47 — Roster transfer consolidation, persistent magic state, and match presentation refinements

- Consolidated My Rosters import into one word-based action with file upload or Share Code entry, consolidated export into one action with file download or Share Code, added a left-side roster filter, and removed the page-level Delete control.
- Restored saved-roster actions in the requested order: View, Edit, Lock, Mark Enemy, Copy, Share, Delete. The enemy action uses the flag icon and is labeled Mark as Enemy Roster.
- Moved each roster point total beside the roster name and removed the redundant VALID / Locked status copy from roster cards.
- Made shared pill UI colors theme-independent so Dark Mode no longer recolors equipment, composition, rule, magic, and status pills.
- Game Length now prefers the minimum round count stated by a selected scenario when the scenario provides a range or minimum and the user has not customized the round count.
- Adjusted Setup spell-card layout so Select sits below the card accent edge and the spell type appears beneath the spell name.
- Added a universal Ongoing Battle Conditions panel at the top of battle phases, replacing phase-specific Wilderness Terrain reminder duplication.
- Redesigned limited-use action status as a larger text-size-aware remaining-use block rather than a miniature pill.
- Added Total Power and Miscast tracking to castable spells. Total Power also marks Miscast, the source Miscast table is selectable inline, casting lockouts persist for the appropriate phase or turn, and source-defined Wizard Level loss can track forgotten known spells.
- Moved Shooting weapon profiles above To Hit penalty controls and only expands mixed Ballistic Skill details when distinct BS values exist.
- Reworked winning Combat Result follow-up choices into the same card treatment as losing outcomes and added explicit roll/test instructions.
- Flattened End of Round Step 2 Round & Score Calculation into the step content instead of nesting it in a second panel.
- Bumped package, header, footer, Settings changelog label, Share Code metadata, and PWA cache metadata to Alpha Build 0.47.

## Alpha Build 0.46 — Canonical match spell cards, deployment gating, and combat-state tracking

- Returned Setup spell choices to the canonical RuleAbilityCard presentation already used by Special Rules and Magical Items, adding only the match Select control rather than maintaining a separate spell-card layout.
- Displayed castable spells in their correct phase and subphase with the same canonical rule box and added mutually exclusive Successful and Failed result tracking for each casting attempt.
- Enforced Deployment Step 2 stage order instead of only sorting it visually: ordinary units resolve before War Machines, War Machines before Characters, and Scouts or special deployment last.
- Restyled the Disruptive Weather Battle Condition as the same expandable rule-panel pattern used elsewhere while retaining its inline D6 table, recorded result, rules access, and required progression gate.
- Corrected the Tips master flip switch specificity conflict so the control renders as a proper switch instead of inheriting generic checkbox dimensions.
- Reduced and centered the Back and Next navigation controls so their labels cannot stretch beyond the match panel, while retaining Start Battle and Begin Round labels where useful.
- Carried successful charge state into Combat Step 1 with a visible Charged marker, including joined Characters through their host unit.
- Locked limited-use rule and item checkboxes as soon as their tracked uses are depleted.
- Added In Combat to Movement Step 2 charge resolution. Hold and In Combat are mutually exclusive with charge actions, while charge actions lock both Hold and In Combat.
- Rebuilt Army Roster entry actions into the compact square management-button pattern: Export, Lock, Enemy toggle, Copy, Share Code, and Delete where applicable.
- Bumped package, header, footer, and PWA cache metadata to Alpha Build 0.46.

## Alpha Build 0.45 — Settings cleanup, Share Codes, rule resolution, and match UI refinement

- Reworked Settings rows to match the clearer Brambleheart presentation while preserving Old.dex Reset Local Data behavior, moved Site Changelog into Changelog & Updates, and removed underlines from download-style controls.
- Renamed Install to Access & Community, added Discord and Share actions in Settings and the global footer, moved Launch Audio above Themes, and simplified Donation controls.
- Replaced QR roster transfer with Old.dex Share Codes. QR generation, camera/image scanning, and QR-only dependencies are removed; the familiar QR-shaped roster-row icon now opens Share Code sharing instead.
- Share Codes are staged locally for review on the short /lists/shared route, including legacy payload links which have their long hash removed from the address bar after receipt. Roster import/export remain compact file transfer actions and Custom Data import remains in Settings.
- Hardened magic-item source resolution so exact item boundaries are respected on collection pages, non-weapon items no longer trigger unnecessary broad fallbacks, and collection-only items can still resolve when an individual route is missing.
- Changed the match Tips master control to a flip switch while retaining individual Tip checkboxes.
- Added a shared match-content gutter so text and controls no longer sit directly against panel borders across setup, deployment, phase, and combat surfaces.
- Reduced Setup spell-card Select, metadata, rule-link, and body text sizes; moved type/signature pills below the spell name; and normalized spell icon sizing.
- Restored Disruptive Weather as an always-visible required pre-deployment D6 table with inline rules access, saved result selection, and progression gating until a result is recorded.
- Bumped package/header/footer/PWA metadata to Alpha Build 0.45 and extended permanent regressions for the new UI and rule-resolution behavior.

## Alpha Build 0.44 — Dropbox roster sync, roster sharing, and match-flow corrections

- Added optional Dropbox App Folder Cloud Sync using OAuth PKCE and explicit manual Update from Cloud / Upload Local actions while keeping local roster storage authoritative.
- Introduced roster sharing with encoded links and QR transfer for read-only shared-roster review before adding a received roster locally; this QR transport was subsequently replaced by Share Codes in Alpha 0.45.
- Removed Match Notes, restored Disruptive Weather as a required pre-deployment result, moved Wilderness Terrain to deployment/later-phase reminders, and corrected Chaos of War instructional text and timing.
- Reworked spell setup and later phase routing so prepared spells can appear in the phase/subphase in which they are cast.
- Added Shooting To Hit calculation beside Ballistic Skill with modifier tracking and mixed-BS expansion.
- Corrected Combat joined-unit wording/click targets, removed magical-item costs from match profiles, and continued match-profile/pill presentation cleanup.
- Added the initial cloud/share and match-flow regression coverage used by later maintenance builds.

## Alpha Build 0.43 — Persistent match tracking, canonical spell presentation, and charge-source calculations

- Rebuilt match tracking around persistent casualties, fleeing state, limited-use counters, charge history, combat history, and turn-specific shooting/rally state.
- Made Setup Battle Conditions selection-only, moved Disruptive Weather resolution to Deployment, surfaced ongoing recorded results where their effects apply, and routed Chaos of War into Start of Turn from round two onward.
- Replaced bespoke Setup spell markup with the shared Old.dex rule-card presentation and added a dedicated match-roster snapshot profile route so in-match profiles come from the roster selected when the match began.
- Grouped Deployment visibly by normal units, War Machines, Characters, then Scouts/special deployment.
- Added Leadership to required-charge unit rows, real Movement fallbacks in Remaining Moves, Ballistic Skill and selectable To Hit penalties in Shooting, and persistent Rally/flee handling.
- Made Combat unit panels open the match snapshot profile, changed single-model status to Wounds Remaining, and retained combat/charge state across the round.
- Rebuilt maximum charge declaration range from active named sources so Swiftstride, Waaagh! Banner and other stacked modifiers are displayed without changing the separate resolved Charge Move rules.
- Removed the broad Dark Mode black-pill override and added permanent regressions for charge modifiers, limited-use tracking, match snapshots, spell presentation, and theme behavior.

## Alpha Build 0.42 — Persistent battle state, deployment sequence, and combat resolution

- Made destroyed-model and wound tracking persistent per roster entry rather than per turn, so accumulated losses carry across Friendly/Enemy turns and every later round until the match is reset.
- Rebuilt random happenings as structured D6 tables and compile only the result actually rolled into match timing; assigned battle panels retain the full table with the active result highlighted.
- Added rules-aware Deployment ordering for ordinary units, grouped War Machines, Characters and Scouts; joined Characters follow the deployment/reserve state of their host unit while specific unit/scenario exceptions remain authoritative.
- Removed the blanket same-troop-class character join restriction and replaced it with explicit incompatible-rule/troop safeguards, including Lumbering, Skirmisher sub-category and special-rule parity checks.
- Persisted structured magical-item charge effects in roster snapshots. Waaagh! Banner and equivalent rules now contribute their maximum charge-range bonus without relying on a live match-page prose scrape; older snapshots retain a canonical-reference fallback.
- Rebuilt Choose & Fight Combat from the active roster instead of treating successful chargers as the definition of combat participation. Units can be marked as having fought whether they charged, were charged or were already engaged.
- Combined Combat Result, Break Tests and follow-up into one combat-resolution step. Losing units record combat-result difference and receive Leadership-based 2D6 result bands; winning units receive follow-up/pursuit/restrain/overrun choices.
- Kept joined Characters as separate wound trackers while attaching their Combat Result, Break Test and follow-up state to the joined host unit.
- Shortened and contained the collapsible match Note field and added responsive layout rules for D6 tables, deployment rows and combined combat-resolution panels.
- Expanded core regression coverage for structured charge effects, Break Test bands, random-happening table preservation, roster-based Combat participation and persistent casualty state.
- Bumped package/header/footer/PWA cache metadata to Alpha Build 0.42.

## Alpha Build 0.41 — Turn ownership, ranged weapons, dispels, and charge reactions

- Enforced friendly/enemy turn ownership at the compiled match-intelligence boundary so an inactive roster contributes only explicit opponent-turn/reaction rules; own-turn rules no longer leak into the other side because their prose mentions the same phase or subphase.
- Corrected Declare Charges & Charge Reactions wording so the source-book subphase name does not reclassify own-turn rules such as Impetuous as enemy-turn reactions; Counter Charge remains an explicit enemy-turn reaction.
- Added canonical match-profile weapon snapshots and a Shooting roster panel so equipped missile/ranged weapons, quantities, Range, Strength, AP and weapon rules are available during the Shooting step.
- Rebuilt enemy Declare & Resolve Charges as per-unit charge-reaction tracking for every friendly unit, excluding joined Characters as separate entries while retaining their applicable reaction rules on the host unit.
- Removed the obsolete Charge rolled & resolved checkbox from the charge sequence; Hold, Charge declared and Successful are the tracked charge states.
- Made Wizardly Dispel and Fated Dispel conditional on an opposing caster having a spell type that can operate in the current step. Fated Dispel is tracked once per round and shown locked after use until the next round.
- Generalized caster hydration so match intelligence can inspect both friendly and enemy roster magic without creating a second timing pipeline.
- Reworked Setup Step 2 spell choices into rule-style boxes with a checkbox directly beside each generated spell name.
- Centered and raised the Setup round-count control and hardened match-panel box sizing/overflow so inset panels stay inside their parent surfaces across text sizes and viewport widths.
- Expanded core regressions for ranged-weapon semantics, own-turn charge-test timing and Shooting weapon integration.
- Bumped package/header/footer/PWA cache metadata to Alpha Build 0.41.

## Alpha Build 0.40 — Match workflow, scenario maps, charge state, and combat tracking

- Reworked match Tips into one canonical collapsible component with a per-match Tips visibility switch in the step heading; Tip panels now stay at the top of their step while charge and Break Test instructions use normal procedure panels.
- Reordered Setup so Scenario precedes Game Length, changed the default match length to four rounds unless the selected scenario states otherwise, and rebuilt spell generation as caster-grouped spell cards with selection checkboxes.
- Centralized pitched-battle scenario paths and deployment maps, displaying the map on scenario rule pages, Setup/Overview and the always-open Deployment Order scenario panel.
- Removed the standalone First Turn deployment step and moved first-turn resolution to the bottom of Deploy Armies after unit deployment and joined-character tracking.
- Expanded and theme-locked Friendly Turn / Enemy Turn controls and renamed Your Turn to Friendly Turn throughout guided match play.
- Added per-round consumable quantity display for match guidance, improved Required Charge Test rule/unit presentation, and increased Pass/Fail control readability.
- Expanded Declare & Resolve Charges with Hold and Successful state, deduplicated per-unit charge rules, broadened detected maximum charge-range bonuses, and routed Counter Charge exclusively as an enemy-turn reaction.
- Rebuilt Remaining Moves around Normal Move, March and Hold choices with calculated movement distances instead of a generic completion checkbox.
- Simplified Choose & Fight Combat to profile links and successful chargers, added capped model/wound casualty steppers to Combat Result, and kept joined-character wounds separate while inheriting the host unit combat result and Break Test/follow-up outcome.
- Formatted long battle/scenario rule bodies into readable paragraphs, strengthened canonical guidance deduplication, fixed note/end-step overflow and added a backdrop to phase/step navigation rails.

## Alpha Build 0.39 — Core rebuild: canonical source semantics, profiles, rules, and runtime cleanup

- Established a canonical core architecture and stopped treating version-specific downstream patches as the normal way to repair data/profile behavior.
- Rebuilt Old World Builder selection classification so source semantics and the selection name determine whether something is a weapon, shield, armour, mount, role or upgrade; documentation URLs are references only and cannot reclassify a Shield as a weapon.
- Moved canonical profile mechanics into the core profile engine behind a compatibility facade and centralized characteristic/save math. Armour replacement resolves before Shield, Armoured Hide and other persistent save modifiers.
- Added the Black Orc Bigboss regression as a permanent core contract: Full Plate Armour remains 4+, Shield stays equipment rather than a weapon, and selecting Shield resolves the eligible character profile to a 3+ Armour Save.
- Removed the superseded v0.33/v0.34 match-guidance services and the duplicate deployment/start-round/turn parser from gameSetup; compiled match intelligence is now the sole match-guidance engine.
- Removed version-suffixed runtime service filenames for locks, match tracking, match unit profiles and magical-item references, updating views to use canonical service boundaries.
- Consolidated the accumulated v0.33-v0.38 CSS override files into the canonical stylesheet and stopped loading successive version stylesheets at runtime.
- Consolidated recent changelog entries into the canonical changelog data source so build history no longer requires a chain of version-specific runtime imports.
- Added a core architecture contract and regression runner covering source classification, shield/profile save math, match timing invariants, and runtime-layering checks.
- Bumped package/header/footer/PWA cache metadata to Alpha Build 0.39 and ships this release as a full replacement-source package so obsolete files are removed rather than left under the rebuilt core.

## Alpha Build 0.38 — Canonical rule-content pipeline and shield save repair

- Rebuilt the shared rules transport around the same minimal rules-index request used by Old World Builder. Old.dex now requests canonical tow.whfb.app rule pages with minimal=true before any page is cleaned, parsed or displayed, preventing source-site navigation, update metadata and error chrome from leaking into rule cards.
- Reworked the central rule-text extractor so Rules, roster profiles, match intelligence and inline rule cards all reject source metadata, Table of Contents text, broken-page notices and navigation fragments instead of each feature maintaining a different permissive fallback.
- Removed broad rule-card fallback scraping that could substitute flavour or unrelated nearby paragraphs when a canonical page did not expose mechanical text. Missing mechanical content now fails closed rather than displaying misleading source text as a rule.
- Added a dedicated magical-item reference resolver. It reads the individual canonical item page first and, when that entry is incomplete, checks the appropriate common or army magic-item collection page and merges the richer weapon profile, Notes and linked special rules.
- Guaranteed Magical Attacks on selected magic-weapon references and surfaced resolved Range, Strength, AP and Special Rules directly inside expanded magical-item picker entries.
- Hardened magical shield detection so a selected magic shield improves the owning model armour save even if its external rule page is temporarily incomplete or unavailable.
- Hardened mundane shield normalization from both the source name and Old World Builder canonical shield path. A selected shield is always treated as a unit-level equipment choice and applies its +1 armour-save improvement to eligible rider/unit profiles.
- Bundled Old World Builder’s current rule-index export and synonym map with Old.dex, while retaining live OWB refreshes when available. Installed/offline sessions therefore keep the canonical name-to-rule resolver required for basic rule linking.
- Invalidated the previous rule-content cache so stale full-page/source-chrome parses cannot survive the new canonical minimal-content pipeline.
- Bumped the package, header, footer and PWA shell to Alpha Build 0.38.

## Alpha Build 0.37 — Match rule fidelity, join restrictions, and battle-control polish

- Kept generic pill UI on a fixed high-contrast light treatment when Dark Mode is active so pill labels remain readable and do not inherit dark-theme text/background combinations.
- Tied the supplied ready_for_murderin_orc.mp3 directly to the installed-application launch scene. Every standalone app load that shows the launch scene now attempts the boot sound at the same time, while retaining the existing Settings audio switch and user-gesture fallback when autoplay is blocked.
- Changed normal match length to four rounds. A selected scenario can still replace that value when its own rules provide an explicit game length; the generic six-round source fallback no longer overrides Old.dex’s normal four-round setup default.
- Removed left/right subphase arrows when a phase has only one step and added rail padding/nowrap safeguards so the final visible phase label does not collide with the scroll edge.
- Restricted Deployment character-joining choices by troop/mount class. Characters now fail closed when their selected mount or troop class is incompatible with the prospective host, and Chariot, War Machine, Behemoth and Swarm-style models are not offered as ordinary joined-unit targets.
- Changed Step Notes to a single collapsible Note panel that is closed by default.
- Rebuilt match rule-card text cleanup to remove source-page navigation, Table of Contents, update metadata and publication/page noise while retaining the complete cleaned mechanical rule text instead of only the one sentence that established timing.
- Tightened Movement, Shooting and Combat timing inference so narrative words such as “march” no longer create tasks without an actual instruction, modifier or operational action. This removes magic-item/flavour false positives such as rules that merely describe warriors marching.
- Deduplicated canonical rule cards by rule identity rather than by the exact extracted sentence. When a joined Character and its host both have the same Individual rule, Old.dex shows one rule with all affected models where appropriate.
- Made Required Charge Test checkbox labels follow the global Text Size setting and increased spacing between affected-unit pills and rule-card dividers.
- Changed Choose & Fight Combat so joined Characters remain separate roster entries rather than appearing nested under their host. Each unit name now links to the roster-equivalent unit profile while the inline expandable profile remains available for rolling at the table.
- Changed Break Test and winner follow-up results from select menus to mutually exclusive checkbox choices. Losing/failed-break entries show only Break Test outcomes; Won Combat entries show only Follow Up / Pursuit choices.
- Simplified empty friendly/enemy action states to the explicit “No actions.” message.
- Bumped the package, header, footer and PWA shell to Alpha Build 0.37.

## Alpha Build 0.36 — Sequential match resolution, joined characters, and combat tracking

- Changed Start New Match battle-composition options to compact pill UI instead of expanded explanatory rows.
- Moved available scenario/battle artwork into the bottom of the expandable Scenario Rules content on Setup, Overview, and Deployment Order so the same scenario reference pattern is used throughout pre-battle play.
- Collapsed each Wizard or Priest into its own independent Setup Step 2 section, reducing clutter when a roster contains multiple casters.
- Added match-only character attachment tracking during Deployment. Friendly Characters can be joined to a unit, appear inside that host during later match actions, and can leave the unit during Remaining Moves without changing the saved roster.
- Combined Declare Charges and Charge Moves into one sequential Declare & Resolve Charges step. Each charge is declared, rolled, resolved, and marked complete before the next charge, with the unit’s relevant charge rules displayed directly in its entry.
- Rebuilt Remaining Moves around unit state: units that declared a charge, resolved compulsory movement, remain joined to another unit, or are still held in Reserve are excluded. Eligible units are shown directly with optional completion tracking.
- Added request-version guarding to asynchronous match guidance so a slow rule lookup from a previous phase or subphase cannot overwrite the currently selected step. This prevents Required Charge Test text such as Impetuous modifiers from leaking into Remaining Moves.
- Reworked Choose & Fight Combat into expandable unit entries with in-place characteristic profiles and joined-character profiles for roll reference.
- Expanded Calculate Combat Result with tracked destroyed-model counts, Banner/Champion/Musician loss checks when present, joined-character casualties, and optional Won Combat / Failed Break Test state.
- Combined Break Test with Follow Up & Pursuit. Units flagged from Combat Result can record Give Ground, Fall Back in Good Order, Flee or destruction plus Follow Up, Pursue, Restrain, Overrun, or no follow-up before the next combat is resolved.
- Replaced exposed horizontal match phase/subphase scrollbars with left and right arrow controls while retaining touch/trackpad scrolling internally.
- Bumped the installed-app shell and package version to Alpha Build 0.36.

## Alpha Build 0.35 — Compiled match intelligence and installed-app launch audio

- Rebuilt match guidance around a central rule-intelligence compiler. Roster rules, magical items, scenario rules, battlefield effects, army/battle compositions and prepared magic are now interpreted once into explicit operational events before any match screen decides what to display.
- Removed broad phase-name matching as the primary routing method. A rule is no longer repeated in a step merely because its text mentions that phase; explicit timing wins, operational mechanics refine broad phase wording, dependent continuation text stays with its triggering event, and ambiguous passive phase references fail closed instead of becoming tasks.
- Made Old.dex order-of-work steps first-class timing targets even when the source book combines them differently. Impetuous and equivalent tests route to Required Charge Tests, while their Pass/Fail result is carried forward to the normal Declare Charges checklist as a MUST CHARGE IF POSSIBLE state.
- Separated rules that create a Required Charge Test from rules that only modify one. Modifiers such as Warband/Quell-style effects can be shown with the test procedure without incorrectly causing every model that has the modifier to make a test.
- Allowed one source rule to generate multiple match events only when it contains genuinely separate mechanics. Charge-range/Charge-roll modifiers can therefore appear with Charge Moves while an Impetuous grant from the same rule appears in Required Charge Tests, without duplicating unrelated rule text across the phase.
- Rebuilt Deployment and Start of Round on the same compiled knowledge model so only deployment/reserve rules and actual Start of Round triggers are shown in those workflows. Friendly and imported enemy roster timing is interpreted relative to the owner of each rule.
- Corrected maximum declaration range to Movement + 6 before explicit maximum-range bonuses; Swiftstride contributes its current +3 maximum-range increase and other detected maximum-range modifiers are added once.
- Kept Wizard/Priest magic tied to its operational spell timing: Enchantment/Hex in Conjuration, Conveyance in Remaining Moves, Magic Missile/Magical Vortex in Special Shooting Actions and Assailment in Combat, with timing-text fallback for abilities that do not use those standard type labels.
- Added an installed-application launch scene using the supplied Old.dex boot audio. Normal browser-tab launches remain silent, and Settings now includes an Installed app launch audio switch that can disable the sound.
- Bumped the PWA shell cache and included the launch audio in the offline application core so installed Old.dex can use it without requiring a fresh network request at boot.

## Alpha Build 0.34 — Match workflow corrections, charge tracking, and Legends of Legacy

- Added lock and delete controls to open matches. Locked matches remain reviewable but cannot be edited until unlocked from Games.
- Extended match-page bottom spacing and mobile safe-area handling so navigation and lifecycle controls remain fully inside the page instead of hanging over the footer.
- Added a Held in Reserve control beside Deployed during deployment, with unavailable reserve choices visibly disabled when no reserve permission is detected.
- Removed decorative item-count bubbles from match task-panel headings while retaining meaningful turn, phase, subphase and deployment progress information.
- Reduced Start of Round to rules and actions that actually resolve there; round number, first player and passive battle-condition summaries remain available elsewhere rather than occupying the Start of Round task list.
- Corrected the timing resolver so explicit named subphases take priority over what a rule does. Rallying Cry now resolves in Command as its rule states, rather than being moved to Rallying Fleeing Troops because it rallies a unit.
- Strengthened Required Charge Test detection by supplementing roster special rules such as Impetuous and routing scenario text about testing whether a unit must charge into Required Charge Tests instead of Declare Charges.
- Rebuilt Declare Charges as a simple unit checklist with maximum possible charge range, detected Swiftstride/range bonuses, required-charge status, and an in-phase charge procedure tip instead of expandable unit rule cards.
- Added phase/subphase tips throughout Strategy, Movement, Shooting, Combat and End of Round, following the older Old.dex battle workflow pattern of showing the immediate procedure beside the actions to resolve.
- Expanded phase-aware battle guidance so selected battlefield effects and Wizard spells are shown in the subphase where their text or spell type says they can be resolved.
- Improved pill and chip contrast across themes by using black text for light pill-style UI surfaces by default.
- Moved all Legacy PDF armies out of their official-book family groupings and into a dedicated Legends of Legacy army-rules category below Ravening Hordes.

## Alpha Build 0.33 — Subphase routing, roster allowances, Legacy armies, and Combat tracking

- Separated Create Army Roster choices into Official Armies and Legacy Armies, removed Renegade Crowns as an independent selector choice while preserving its data identity, and added a LEGACY pill to saved Legacy rosters.
- Added an explicit approval control for otherwise-valid rosters that still have unused magical-item allowance points; approval is tied to the exact remaining allowance state and automatically expires when those allowances change.
- Stopped unselected optional upgrades from creating magical-item allowance warnings, including potential Magic Standard allowances that do not exist until the relevant Standard Bearer or other granting option is actually selected.
- Reworked profile-role handling around Unit Models, Champion, Special Model and Mount so unit-wide upgrades and persistent characteristic modifiers are applied to the models they actually affect rather than leaking to only a champion or to unrelated profiles.
- Added the first generalized subphase timing resolver so explicit rule-text timing can be separated from broad phase wording; Alpha 0.34 further corrects precedence and Required Charge routing edge cases discovered during match testing.
- Rebuilt in-match phase navigation around separate major-phase and numbered subphase rows, clearer current-step context, mobile horizontal scrolling and persistent Back/Next controls.
- Moved battle scenario and other shared battle rules to the top of the current phase/subphase task stack and changed scenario/rule guidance to expandable inline rule panels.
- Reworked Required Charge Test so special rules appear first, the Multiple Units wording is removed, and affected units with Pass/Fail controls are listed separately at the bottom.
- Expanded Combat with available Assailment spells and their casters plus a per-unit completion checklist for Combat rolls.
- Added a match-layout spacing pass for wrapped labels, rule cards, phase controls and mobile task panels.
- Added the Olddex Games Workshop / BSData disclaimer to every application page except the splash screen.

## Alpha Build 0.32 — Roster-rule fixes, integrated custom units, and mobile polish

- Increased splash-page typography by 2px and fixed the mobile/tablet Text Size control so its flex basis cannot stretch the selector into an oversized vertical field.
- Corrected shield save handling so armour replacements resolve first and selected shield/save modifiers are applied afterward instead of being overwritten by source option order.
- Changed per-1,000-point composition limits to inclusive tiers: 0–1,000 uses one allowance, 1,001–2,000 uses two, and each additional 1,000-point band adds another allowance.
- Removed Armour Save from mount profile displays; mount profiles retain their own characteristics and no longer present an armour-save contribution as a model save.
- Added a roster Lock/Unlock control between View and Export on the Army Rosters page and tightened model-count number centering across mobile browsers.
- Enabled custom-data JSON import from Settings in addition to the roster page and removed the remaining footer-language-control styling.
- Integrated custom units into their real roster categories while keeping a visible CUSTOM marker; custom units remain gated by the Allow Custom Units battle-composition option.
- Updated bundled Grimgor Ironhide to Characters and replaced Da Boyz with the custom Da Bigst Boys rule, allowing Grimgor to satisfy the Black Orc character requirement for all Black Orc Mobs.
- Added rule-text redundancy filtering for vice-versa quota wording and deduplicated repeated special-rule cards so equivalent source sentences are not displayed multiple times.
- Added optional, persisted completion checkboxes to match turn guidance for both Your Turn and Enemy's Turn; checking an item never blocks phase progression.
- Consolidated Required Charge Test guidance so shared rules such as Impetuous/Warband appear once with all affected units beneath them, and added optional Pass/Fail tracking that carries failed required-charge tests into Declare Charges as must-charge-if-possible flags.
- Reworked Your Turn Declare Charges to show roster charge candidates instead of repeating Required Charge Test rules.
- Assigned bundled Grimgor Ironhide a 355-point custom estimate, kept him in Characters by default with an optional General role, and kept Da Bigst Boys as a direct exemption to the reciprocal Da Boyz Black Orc Mob character requirement.
- Corrected roster status colouring so a legal roster is green even when below its points limit (or legally using Over / Under); yellow is now reserved for otherwise-valid rosters with unspent Magic Item allowance points.

## Alpha Build 0.31 — Canonical profile integrity rebuild, custom data imports, and splash cleanup

- Rebuilt model-profile ingestion around exact faction, army-composition, roster-unit, rules-page and model-profile identity instead of treating the first returned profile row as authoritative.
- Made Old World Builder’s complete indexed characteristic rows the primary base-profile source, tightened rules-page and Builder-data fallbacks to complete M/WS/BS/S/T/W/I/A/Ld records, and made ambiguous multi-profile resolution fail closed rather than guess.
- Separated persistent model-characteristic changes from contextual weapon/rule effects: armour and match-long model bonuses may change displayed model stats, while weapon Strength/AP and turn/phase/attack-only effects remain on their weapon or rule context.
- Removed generic option-reference-page characteristic enrichment so selected weapons and other option rules cannot leak their modifiers into a model’s base WS/S/etc.; roster-dependent permanent upgrades remain scoped to explicit named characteristic text.
- Invalidated the previous rules/profile data caches so stale profile parsing cannot survive the rebuild.
- Removed the splash-page Gift/Support block, changed the Rules Index Project and Nico Thiebes acknowledgements to regular weight, removed the footer language selector, and reduced/padded the install artwork so it is not clipped.
- Removed obsolete patch-delivery scaffolding from the repository root; Old.dex now ships the updated source directly rather than payload/apply/manifest patch artifacts.
- Added a canonical Custom Units data path with browser JSON import, local persistence, composition-aware unit selection, and fail-closed validation for complete M/WS/BS/S/T/W/I/A/Ld profiles.
- Bundled the supplied Grimgor Ironhide custom test data for Orc & Goblin Tribes Grand Army; his locked base profile remains separate from Gitsnik weapon modifiers, while Blood-Forged Armour supplies the persistent armour and Ward values.

## Alpha Build 0.30 — Scenario workflow, compact turn views, and spell timing guidance

- Updated every Old.dex Gift action to the current one-time and recurring Stripe destinations.
- Tightened Start New Match roster checks so roster-status warnings appear only for red/invalid rosters, while match-level point-limit and unequal-allowance errors remain visible.
- Moved scenario rules into an in-match popup, kept available scenario maps directly in Setup, and expanded scenario guidance with distinct set-up, deployment, first-turn, special-rule and game-length sections.
- Reworked Setup Step 2 spell cards as collapsible panels containing spell-only details such as type, casting value, range and effect while retaining the lore reference link.
- Expanded Overview with scenario-specific battlefield/deployment/first-turn details, an available scenario map, and the enabled composition options for both friendly and enemy rosters.
- Cleaned Deployment guidance so units with no formation rules show no placeholder formation text, scenario deployment no longer repeats terrain setup, and the First Turn tip supplies the standard matched-play roll-off procedure when a scenario gives no different procedure.
- Moved Your Turn / Enemy's Turn into compact centered controls beside the step counter, with friendly and enemy visual shading, and synchronized the initial turn view to the side selected during Deployment Step 3.
- Added selected Wizard spells to the exact Your Turn subphases in which their spell type can be cast: Enchantment/Hex in Conjuration, Conveyance in Remaining Moves, Magic Missile/Magical Vortex in Special Shooting Actions, and Assailment in Combat.
- Corrected upgrade-characteristic enrichment so roster-dependent upgrades only apply explicitly stated characteristic modifiers; Celestial Dragon Guard now applies only +1 WS and +1 Ld, and prerequisite-model rule pages can no longer leak unrelated profile values into upgrades.

## Alpha Build 0.29 — Roster dependency rules, scenario deployment maps, and round-flow refinement

- Reworked the Rules-page introduction so the redundant welcome/disclaimer paragraph is removed and the external Rules Index plus official FAQ/Errata links follow the Old World Downloads version note.
- Renamed Settings and Welcome support actions to One Time Gift and Recurring Gift.
- Expanded source-option interpretation with generic roster-wide prerequisites and 0-N selection limits, including requirements tied to another included model or the army General, and disabled unavailable upgrades instead of allowing illegal selections.
- Added persistent upgrade-profile enrichment: selected upgrades can apply characteristic modifiers read from their own source notes/reference or from prerequisite-model special rules, so stronger variants update the displayed model profile rather than only changing the option label.
- Moved Start New Match Roster Check below Battle Composition, moved Game Length above Scenario in Setup Step 1, removed the Friendly Magic panel from that page, and surfaced scenario/deployment map artwork from the canonical scenario source when available.
- Split Start of Round into Battle Effects followed by Player Effects so shared scenario/battlefield/composition effects resolve before friendly and enemy army/model effects.
- Changed match lifecycle controls so pre-battle Setup/Overview/Deployment use Cancel Match, Start Over and Save to Ongoing, while post-deployment battles use Concede, Enemy Yielded, Draw and Save to Ongoing.
- Expanded Enemy's Turn guidance with core friendly responses including Wizardly/Fated Dispel, charge reactions and defensive shooting actions.
- Moved the running score controls out of the match header and into End of Round Step 2, where round scoring and next-turn/end-round routing are resolved together.
- Tightened the manual repository-cleanup workflow around root generated artifacts only and explicitly documented protected source/configuration paths.

## Alpha Build 0.28 — Interaction standards and turn-context battle guidance

- Standardized non-editable interaction surfaces across Old.dex so buttons, labels, selection cards, and other controls no longer present a stray text-entry caret while genuine form fields retain normal editing and focus behavior.
- Rebuilt the shared Magical Item picker row around explicit checkbox/label and details-button controls so every army and model uses the same interaction path.
- Added a persistent Your Turn / Enemy's Turn context selector to Strategy, Movement, Shooting, Combat, and End-of-Round phases and all of their subphases.
- Added cached phase/subphase rule guidance that filters the friendly roster and applicable battle sources to the current step; Enemy's Turn focuses on friendly reactions, opponent-turn triggers, and shared combat/break interactions.
- Replaced automatic turn switching at the end of the workflow with explicit Back, Your Turn, Enemy's Turn, and End of Round controls so only End of Round increments the completed-round tracker and advances to the next Start of Round.

## Alpha Build 0.27 — Match validation, deployment guidance, and Start of Round rules

- Changed Wizard spell-lore selection to a single-choice state and added a rider-profile safeguard so mount-granted Wound bonuses are applied to the character exactly once.
- Added a conditional Start New Match roster-check panel that flags invalid/warning rosters, over-limit rosters, and mismatched friendly/enemy point allowances before the match is created.
- Moved match round-count configuration into Setup Step 1, persisted custom game length independently of scenario defaults, and simplified the pre-battle Overview by removing the editable current-round and rounds-completed controls.
- Rebuilt Deployment Step 2 around the friendly roster only, showing each unit’s legal formation rules, deployment-specific rules, and a saved Reserve state when the unit or scenario permits it.
- Added dynamic deployment-rule reading so army-specific deployment mechanics can be discovered from their canonical rule pages rather than relying only on a fixed Vanguard/Scouts/Ambushers list.
- Expanded Start of Round into a rules-guidance phase that checks friendly and enemy roster special rules plus scenario, battlefield, battle-composition, and army-composition sources for effects that explicitly resolve at the start of a round.

## Alpha Build 0.26 — Old World Builder data-resolver rebuild and live source languages

- Rebuilt Old.dex data identity around Old World Builder’s own rules-index-export, additional rule mappings, synonym table, and name-normalization logic instead of relying on guessed slugs as the primary resolver.
- Moved unit and mount characteristic profiles to Old World Builder’s indexed stats first, with TOW page parsing retained only as secondary enrichment for metadata and full rule text.
- Made weapon and special-rule paths resolve through the canonical Old World Builder map before TOW fetching, while retaining the existing incomplete-transport safeguards for pages whose browser-visible content is richer than the fetched HTML.
- Replaced naive comma splitting in source rule/equipment interpretation with resolver-aware parsing so canonical names containing punctuation are preserved while compound source selections still separate correctly.
- Expanded mount enrichment so a selected mount can inherit indexed profile data and referenced source-unit rules/equipment when those details are stored on the standalone model rather than repeated on the parent character option.
- Added a whole-army resolver audit service that can enumerate unresolved units, mounts, weapons, and rules and report a resolution rate for future data-integrity regression checks.
- Activated footer language preferences for live Builder-source data by reading the same localized name fields used by Old World Builder and reloading roster-builder, model-profile, and roster-view data when the language changes.

## Alpha Build 0.25 — Installable app, source-rule cleanup, and guided match setup

- Added Progressive Web App installation support for phones, tablets, and desktop browsers, using the supplied Old.dex artwork for browser, home-screen, and installed-app icons.
- Tightened the Support action buttons, stabilized roster-list controls by moving import status into the fixed left summary area, and rebuilt delete-selection rows so roster names and labels remain compact instead of collapsing into oversized cards.
- Reworked special-rule text extraction to split flattened source pages into individual sentences, reject source/update metadata and flavour-only sentences, retry incomplete rule pages, and require mechanical language before fallback text can appear. This addresses cases such as Fear of Elves without creating a rule-specific exception.
- Changed the Magical Item picker to hide items that cannot currently be afforded while keeping already-selected items visible for removal.
- Snapshotted friendly and enemy roster/composition details into new matches so Setup and Overview remain stable even if the saved roster changes later.
- Expanded Setup with friendly/enemy roster details plus a friendly Wizard/Priest list, match-only lore selection where source options allow it, and a second step for recording generated Wizard spells or reviewing available prayers.
- Added contextual Tips to both Setup steps and the initial Overview, including spell-generation guidance and direct access to the relevant rules reference, and replaced the bare Overview with an at-a-glance battle dashboard for matchup, scenario, score state, prepared magic, and battle-flow progress.

## Alpha Build 0.24 — Read-only enemy rosters, local data controls, and authoritative weapon references

- Made rosters flagged as Enemy Army Rosters view-only: normal navigation opens the roster overview, direct Builder/profile edit routes are locked, and enemy rows no longer expose Copy or Export actions until the roster is moved back to the friendly list.
- Corrected the Support action dimensions and aligned the Games title, Start New Match, Open Matches, and Match History panels to the same page column width.
- Increased green/red/yellow roster-state tint and border contrast so valid, invalid, and warning roster states remain visible in both light and dark themes.
- Added separate Settings controls to clear ongoing matches, completed match history, friendly rosters, or enemy rosters without requiring a full local-data reset.
- Reworked weapon-reference ingestion around the canonical tow.whfb.app Weapons of War page: incomplete cached pages are retried live, weapon self-names and reference-table links are rejected as pseudo-rules, and Notes links are promoted only when they actually target Special Rules.
- Added a canonical weapon-page fallback for Grand Cannon when the transport-safe source returns an empty Special Rules cell, restoring Armour Bane (3), Cannon Fire, Cumbersome, Move or Shoot, Multiple Wounds (D3+1), and Thunderous Impact while keeping the Black Powder Misfire table in Notes rather than the Special Rules column.

## Alpha Build 0.23 — Match setup, enemy rosters, support actions, and rule-detail reliability

- Replaced the Support links with the production one-time and recurring Stripe URLs and presented both as centered side-by-side buttons below the support disclaimer.
- Simplified Games filtering to icon-driven filter menus while retaining search, three-item default lists, and match metadata filtering.
- Reworked Start New Match around Friendly General and Enemy General panels, each with an always-available general-name field plus roster selection/import controls.
- Added friendly-roster battle composition details beneath the scenario information and reversed the Create Match / Cancel action order.
- Replaced Army Roster View and Export text actions with icon actions and added an Enemy Roster flag that moves flagged rosters into a separate Enemy Army Rosters group.
- Preserved enemy-roster status through native JSON export/import and list duplication.
- Improved magical-item selection descriptions with background detail loading and stronger fallback extraction while keeping unaffordable legal items visible and greyed out.
- Added a second rule-card detail fallback so special-rule and magical-item cards can recover readable information when the primary rules-index extraction returns no summary.
- Reworked unit-profile loading so the base Builder profile renders immediately while special rules, weapon details, and optional profile references continue enriching in the background, eliminating the previous all-or-nothing profile wait.

## Alpha Build 0.22 — Roster workflow, match tools, and rules-profile polish

- Made image-backed text panels more transparent with a light backdrop blur, removed Background panel divider borders, and replaced Donations with explicit one-time and recurring Support actions.
- Expanded Games with compact three-item defaults, filters and search across match names, rosters, factions and points, and aligned the Games content width with the rest of Old.dex.
- Reworked Start New Match so both players can select or import rosters, replaced premature first-player selection with scenario information, and moved first-turn recording into the Deployment workflow.
- Added actual-versus-limit roster totals, green/yellow/red roster state tinting, native JSON export, and a read-only roster overview with unit loadouts, rules and profile tables.
- Repaired magical-item picker layout and preserved imported Old World Builder magical-item selections and points where the JSON contains them.
- Expanded Wizards & Magic with source lore/magic choices, removed redundant enforced-choice notes, centered model-count controls, widened the roster total display, and normalized counted Hand Weapon labels.
- Improved weapon rule ingestion so linked mechanical Notes such as firing and misfire procedures are surfaced with the weapon profile site-wide, and removed unresolved rule-text placeholder copy.
- Contained Select Units action dividers so Add/View controls render cleanly and disabled the unfinished Custom Units battle option until it has functional data support.

## Alpha Build 0.21 — Interface readability, JSON imports, and weapon-data integrity

- Restored the original site-wide interface text scale while keeping the larger OLD.DEX, ALPHA BUILD, and Changelog header treatment isolated to the header.
- Added theme-colored back panels for exposed text when a custom background image is active and corrected Settings text contrast in dark faction themes.
- Repaired the Select Units modal so rows retain readable height and columns, and centered/colored the Create List Cancel action red.
- Kept selected Battle Composition option details permanently expanded with larger default text.
- Properly capitalized Magical Lore names, changed spell-lore phase labeling to Winds of Magic, and added lore-specific keywords to selected lore rule cards.
- Enabled JSON army-list import from Army Lists, active list-building, and Start New Match, including native Old.dex and Old World Builder JSON formats.
- Fixed nested source-option selection IDs, expanded bomb/grenade weapon recognition, and merged source-specific weapon rules with shared weapon-reference rules site-wide.

## Alpha Build 0.20 — Magic selection, composition options, display polish, and Games groundwork

- Refined roster percentage presentation so only the current percentage is status-coloured, zero-percent rows remain neutral, VALID/INVALID badges are centered, and Army List popouts/text-size controls fit their available space more reliably.
- Increased OLD.DEX/build/Changelog readability, deepened all light faction themes, improved Legions of Undead contrast, corrected dark-theme highlight text/icon contrast, and added four fixed user-selectable site background images.
- Added multi-category unit-picker tabs that preserve selections while moving between categories, an Over - Under option allowing a yellow-valid +10 point tolerance, and Monster Mash support for one eligible non-character Monstrous Creature, War Machine, or Chariot to count as Core.
- Added expandable Battle Composition option explanations and a Cancel action to list creation.
- Reworked Wizard Level into Wizard & Spell Lores, persisted selected spell/prayer lores into roster profiles, surfaced selected lores and source spell-like abilities as Special Rule cards, and retained magical-item fluff where available.
- Replaced the inline magical-item selector with a staged popup containing item-type tabs, live allowance accounting, unaffordable-item disabling, expandable descriptions, Finish-to-commit behavior, and X/Cancel discard behavior.
- Started the Games section with Start New Match, Open Matches, Match History, saved-list based match creation, and a persistent Setup/Overview/Deployment/Strategy/Movement/Shooting/Combat/End phase-step workflow based on the prepared Old World Battle groundwork.

## Alpha Build 0.19 — Roster status, current General, local-data reset, and faction themes

- Removed the stray divider above Army Validation issues and normalized Melee/Range special-rule pills to the same centered, regular-weight pill treatment used elsewhere.
- Added requirement-aware red/yellow/green status coloring to category percentages: minimum requirements progress from red to yellow to green, while maximum allowances progress from green to yellow to red as the limit is approached.
- Moved each roster unit/model point total into a centered rectangular badge above Edit/View/Copy/Remove controls and added a light (Current) marker after the roster model already assigned as General.
- Added a Reset local data action that clears saved lists, favorites, cached content, and other locally added Old.dex data while preserving Display settings.
- Replaced the Themes placeholder with collapsible Forces of Fantasy, Powers of Chaos, Legions of Undead, and Ravening Hordes theme switches, with dedicated light and dark palettes so Dark mode remains fully compatible.

## Alpha Build 0.18 — Roster totals, profile sizing, weapon AP, and publication completeness

- Removed percentages from the top roster point total while keeping category percentages as rounded whole numbers and preserving the selected/points/allowance percentage format within category summaries.
- Moved unit-size information beneath the profile points badge, placed model add/remove controls directly beneath the current model count, and removed the duplicate Unit Size field from Unit Details.
- Changed selected Magical Item cards to true two-column grid rows, centered melee/range weapon table content, reserved more width for Special Rule pills, and added conditional AP presentation for profile-level AP improvements such as Choppas and Armour Bane.
- Added contextual General labels that identify the other roster model currently selected as General, guaranteed a list-publication fallback for every live unit, and added spacing above roster validation issue rows.

## Alpha Build 0.17 — Rule-card links, settings hierarchy, and roster category accounting

- Capitalized special-rule callout keyword pills and linked Special Rule/Magical Item type pills directly to their underlying rule or item pages when available.
- Matched selected Magical Item cards to the same responsive two-column card flow used by Special Rules while retaining their attached owner, points, quantity, and removal controls.
- Reordered Settings so reporting appears first, moved reset controls and a Themes placeholder into Display, removed the separate Local section, and placed Donations immediately above Data & Content.
- Improved OLD.DEX/build/Changelog header spacing and changed roster category summaries to show selected count, points, allowance/requirement remaining, and current-versus-target percentages in one line.
- Renamed Composition Rule to Battle Composition and Composition Options to Battle Composition Options throughout list creation and list settings.

## Alpha Build 0.16 — Profile semantics, roster presentation, and project-history reconciliation

- Cleaned Magical Item and Army validation presentation, neutralized Special Rule/Magical Item type keywords, and centered the profile favorite control.
- Added Magical Attacks to profile keywords whenever an equipped magical weapon grants magical attacks, and split sentence-like special-rule parenthetical callouts into their own linked keyword pills.
- Changed mount Armour Save display to show the armour bonus contributed to the rider (for example +1 from Armoured Hide) or — when the mount contributes no armour bonus.
- Changed upgraded profile presentation so explicit upgrade profiles such as Big ’Uns replace the ordinary model profile instead of displaying both versions together.
- Renamed magic/composition options for clarity, added roster point percentages beside point totals/requirements/allowances, and added Settings placeholders for bug reporting and donations.
- Added the application-wide work-in-progress banner, increased the OLD.DEX header wordmark, and reconciled the in-app and GitHub changelogs into one duplicate-free canonical history.

## Alpha Build 0.15 — Army-list rules, dynamic profiles, points, and expanded icons

- Added Magical Category limiting and Magical Maelstrom composition behavior, including free maximum-plus-one Wizard levels and roster-wide category validation.
- Completed dynamic Ward Save, Regeneration, Armoured Hide, mount/rider characteristic, Wizard-level, magic-item, and war-machine weapon presentation in unit profiles.
- Unified unit point calculation across the picker, default roster entries, edited units, magic items, per-model equipment, and mixed-model weapon allocations.
- Added dedicated pill links for equipped weapon rules, moved Special Rule/Magical Item type markers into rule-card keyword footers, and standardized Army List typography, icons, pills, and validation UI.
- Removed match-only terrain/weather choices from list composition, stabilized dynamic-profile scrolling, fixed roster Edit autosave freezing, and expanded the icon pack with six spell-category icons.

## Alpha Build 0.14 — Source architecture, loadouts, and option normalization

- Made the Vue/TypeScript application the only implementation source, converted standalone preview output into a generated review artifact, and added ODX-CODE static analysis/regression coverage.
- Centralized loadout, persistence, schema, composition, network/storage, error-handling, and rule-helper behavior while reducing duplicate preview/CSS architecture.
- Finalized equipped-only melee/range tables, persistent Hand Weapon behavior, unit-level Shield selection, and explicit per-model mixed-armament allocation.
- Normalized Wizard starting levels, option prerequisites, Equipment & Options ordering, magic-item selection/removal, mount movement/bonuses, and dynamic Ward/Regeneration behavior across applicable units.

## Alpha Build 0.13 — Approved icons and equipped-weapon presentation

- Rebuilt the supplied characteristic/rule icon set from the approved artwork, including Attacks, Ward Save, Special Rule, Spell, and Regeneration corrections.
- Applied specific rule-category icons where available and retained the generic Special Rule icon only as a fallback.
- Changed melee/range profile tables to show only equipped weapons and moved optional weapon choices into Equipment & Options, with mixed-armament quantity controls where source rules require them.

## Alpha Build 0.12 — Builder selection-state stabilization

- Added the in-app Changelog and corrected source-included versus optional weapon/equipment/mount selections so defaults remain selected/locked and alternatives remain interactive.
- Stabilized Wizard level exclusivity and persistence so each Wizard displays one current level rather than multiple simultaneous defaults.
- Corrected owner-specific weapon/profile visibility, dynamic Ward Save rows, characteristic ordering/recentering, and queued multi-unit selection completion.
- Removed Available Lores from Unit Details when they represented choices rather than selected lores, and added the Custom Data Settings placeholder.

## Alpha Build 0.11 — Composition controls, profile icons, and Create List reliability

- Added characteristic icons and Regeneration to Army List profiles, composition options for Allies/Mercenaries/Custom Units, named-character General enforcement, and invalid-entry highlighting.
- Reorganized Settings, corrected Builder default/Wizard metadata handling, separated magic-item allowances by owner, and preserved Builder unit-size bounds.
- Fixed asynchronous Create List refresh state that could wipe selections or freeze the page while live composition data loaded.

## Alpha Build 0.10 — Weapon ownership, list management, and roster status

- Separated weapon ownership inside multi-profile units, renamed Missile Weapons to Range Weapons, atomized compound weapon descriptions, and added linked weapon-rule references.
- Improved mount ordering, mounted-only cleanup, Armoured Hide save effects, repeatable magic-item quantities, and owner-specific magic allowances.
- Added persistent list locking/copy/delete management, improved Back behavior, expanded equipment lines, removed war-machine armaments from model Equipped labels, and added explicit roster VALID/INVALID status.

## Alpha Build 0.09 — All-army roster validation and magic workflow

- Expanded live Builder/profile loading beyond the initial Orc & Goblin data and added composition validation, category limits, General requirements, list Settings, favorites, and lock groundwork.
- Added category point/requirement accounting, explicit unit-picker Add controls, dynamic General/Battle Standard Bearer roster roles, and broader profile hydration.
- Reworked magic-item filtering for owner permissions, Battle March/point restrictions, magical-weapon ordering, mixed-armament quantities, profile loadout lines, and initial upgrade-profile handling such as Big ’Uns.

## Alpha Build 0.08 — Data baseline, migration, and Builder integration

- Introduced versioned storage migration and explicit external-data baseline/status checks while removing dependence on older legacy storage keys.
- Expanded remote Old World Builder faction/magic-item loading with fallback handling and established the data-reference architecture later used by Army List profiles.
- Added the top-level battle summary with victory-point and attack-state information while retaining the complete tracked phase workflow.

## Alpha Build 0.07 — Round carry-forward and versioned battle state

- Expanded collapsed round history and automatic carry-forward for destroyed/fleeing units, banners, ranks, reserves, and other battlefield state.
- Formalized versioned battle-state storage/migration while preserving the complete Setup through Combat workflow.

## Alpha Build 0.06 — Shooting, casting, combat, and full phase workflow

- Expanded shooting To Hit/To Wound sequencing with range, cover, and skirmisher modifiers and added passive casting-item effects, casting modifiers, and rerolls.
- Expanded combat entries for joined characters, mounts, champions, initiative ordering, challenges, synchronized challenge damage, and overkill.
- Consolidated the full tracked phase workflow with charge tests/declarations, movement calculations, and stronger between-round state carry-forward.

## Alpha Build 0.05 — Imported armies and richer combat/profile UI

- Made imported friendly army data the source of truth for army totals, costs, model counts, and profiles and removed redundant friendly point-entry fields.
- Added richer profile/initiative/challenge/cast/item-use presentation and improved import-status feedback as imported-army integration stabilized.

## Alpha Build 0.04 — Scenario checks, import UI, and live round state

- Expanded challenge/overkill, initiative, defensive-profile, deployment/formation, and spell-resolution presentation.
- Added friendly-army paste/file import controls and scenario-specific start/deployment checks including Meeting Engagement reserve rolls.
- Formalized the main Setup/Overview/Deployment/Strategy/Movement/Shooting/Combat flow and expanded live round-state tracking for characters, casualties, reserves, banners, models remaining, and victory points.

## Alpha Build 0.03 — List import, scenarios, and persistent spell/challenge state

- Added opponent and friendly list import/storage groundwork, army list-type/battle format/scenario selection, and first-player setup.
- Expanded deployment/formation state plus persistent spell attempt/skip, target, casting/dispel, Miscast, Remains in Play, challenge profile, and overkill tracking.

## Alpha Build 0.02 — Battle-state presentation, defense, and round overview

- Refined Turn 1/later-round overview presentation and added calculated movement allowances, clearer must-charge handling, and reserve carry-forward.
- Added defense/save panels, incoming AP/adjusted armour/Ward Saves, weapon selection, command-casualty tracking, and broader charge/shooting/panic handling.

## Alpha Build 0.01 — Initial Old.dex battle tracker

- Established the fixed Orc & Goblin test force, initial unit profiles/weapons/special-rule references, and the core battle-phase shell.
- Expanded the prototype into a persistent phase/subphase tracker from deployment through End of Turn with movement, charges, shooting, combat, and break outcomes.
- Added rule-step validation for vortex/rally/Impetuous/charges/flee/movement plus casting, Miscast, targets, dispels, reserves, formations, casualties, banners, and combat-result resolution.
