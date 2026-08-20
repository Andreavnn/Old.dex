# Old.dex GUI v0.52

This build continues the code-remediation baseline and applies the current Army Lists/profile rules and UI review to the canonical Vue/TypeScript application source. The deployed Vue application is the primary review target; standalone previews, when generated, are build artifacts only.

## v0.52 changes

- Fixed the roster Edit autosave feedback loop that could freeze a browser tab after opening an added unit.
- Stabilized scroll position while dynamic characteristics, saves, mounts, and other profile modifiers change the characteristic row.
- Unified point calculation across the unit picker, default roster rows, edited profiles, per-model choices, mixed weapon counts, Wizard modes, and magic items.
- Moved Special Rule/Magical Item type pills to each rule card's keyword footer, cleaned selected magic-item card layout, and replaced generic weapon-rule placeholders with available specific weapon-rule pills.
- Normalized concatenated troop-type text and changed Unit Details to show the starting unit size (for example, `5+ models`) rather than the current edited roster count.
- Rebuilt the Settings text-size selector as a fixed five-choice horizontal control with no internal scrollbar.
- Extended the approved icon pack with dedicated Magical Vortex, Enchantment, Hex, Conveyance, Magic Missile, and Assailment icons while retaining the approved 14 characteristic/rule icons.

## v0.51 changes

- Equipped melee and ranged weapons render pill links for all applicable weapon special rules; Special Rule and Magical Item cards display their own type pills.
- Characteristic artwork was optically recentered and Army List icon geometry, rounded pills, typography, spacing, and validation presentation received a whole-section cleanup.
- Dynamic Ward Save and Regeneration behavior is regression-tested; Regeneration granted by equipment/magic is no longer erased when no separate Regeneration rule is present.
- `Limit 1 Magic` validates the entire roster to one magical item per category. `Magical Maelstrom` raises active Wizards to normal maximum +1 for free and marks them with a Magical Maelstrom pill.
- Wilderness Terrain and Disruptive Weather were removed from list-composition options because they belong to match/game setup.
- Wizard level defaults are mutually exclusive, Frenzy upgrades are grouped under Special Rules & Upgrades, and magic items remain removable.
- Cannon, Stone Thrower, Bolt Thrower, Mortar, Trebuchet, Doom Diver, and similar war-machine armaments are treated as ranged weapons rather than equipment.
- Characteristic profiles are ordered Unit → Champion → optional model → mount, while Armoured Hide and mount armour effects continue to modify the appropriate profile save.
- Option prerequisite parsing was broadened so named dependencies are enforced consistently across applicable Army List units rather than by isolated unit patches.

## v0.50 changes

- Wizard starting levels are normalized independently for every Wizard owner/group and source-default starting levels remain locked until that Wizard is upgraded.
- Option dependencies are normalized generically from source requirements, including Frenzy/Warpaint, crew-count choices, and mounted-only options.
- Ward Save and Regeneration characteristics appear only when active; removing the granting option removes the characteristic again.
- Optional mounts replace the rider's Movement with `—` while mounted and apply rider characteristic bonuses as `base(modified)`, restoring the original profile when dismounted.
- Equipment & Options now uses a stable logical order and consistent 30 px per-model add/remove controls; Shields remain unit-level checkboxes.
- Magic-item selection uses one selector with no search/type fields. Chosen items render beneath it as dedicated boxed rule cards and no longer appear in Special Rules.
- Army Lists, list deletion, list creation/settings composition controls, and roster UI received a whole-section consistency pass. Composition choices in creation/settings are plain text rather than label pills.
- Settings Text Size choices stay left-to-right, including narrow layouts.
- Standalone review output is generated from `src/` by the review build; it is never an implementation layer.

## v0.49 changes

- Shields are unit-level checkbox selections; pricing scope is handled independently from selection scope.
- Optional melee/ranged weapons appear in their profile tables only while equipped.
- Hand Weapon remains universally equipped unless source data explicitly removes it.
- Per-model add/remove controls are limited to explicit mixed-armament weapon allocation groups.
- Loadout/rule helpers, persistence, schemas, error handling, and composition parsing were consolidated and hardened.
- Application behavior is implemented only in the Vue/TypeScript source.
- A standalone `preview.html` is included for double-click review; it is a generated review artifact and must never be used as an implementation layer.
- Added a dedicated review-build workflow so future previews are generated from the same application source rather than patched separately.
- ODX-CODE static analysis and regression tests were added, together with a clean-build CI workflow.

## v0.48 changes

- Melee and Range weapon profile tables now show only weapons the model/unit is actually equipped with.
- Optional mundane weapons now live under Equipment & Options and only move into the appropriate profile table after selection.
- Hand Weapon is treated as universally equipped unless source data explicitly states otherwise.
- Mixed-armament units use per-model add/remove controls for weapon choices instead of weapon checkboxes, without consuming the universal Hand Weapon allocation.

## v0.47 changes

- Rebuilt the 14 supplied icons directly from the approved image: Movement, Attacks, Weapon Skill, Ballistic Skill, Strength, Toughness, Wounds, Initiative, Leadership, Armour Save, Ward Save, Special Rule, Spell, and Regeneration.
- Corrected the Attacks icon to the double-headed axe.
- Corrected Special Rule to the starburst and Spell to the fireball.
- Replaced the earlier Regeneration asset with the approved circular healing mark.
- Rule cards now prefer a matching approved icon for movement, shooting, combat, strategy, and magic; the generic Special Rule icon is used only when no better category applies.
- Unit profile order remains `M, WS, BS, S, T, W, I, A, Ld, Sv`, followed by conditional `Wd` and `Rn`.

## Running the modular source

```bash
npm install
npm run check
npm run dev
```

The deployed Vite/Vue application is the primary review surface. `npm run build:review` can still generate a standalone `preview.html` from the same application source when needed. It is never the application source of truth. See `REVIEW_PREVIEW_WORKFLOW.md`.
