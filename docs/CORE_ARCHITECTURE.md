# Old.dex Core Architecture

Alpha 0.39 establishes the canonical application core. New work must change the owning core layer rather than adding version-specific compensating patches downstream.

## Source of truth

Old World Builder source structure determines semantics. `equipment`, `armor`, `options`, `command`, and `mounts` are separate source concepts. A rules-index URL is documentation metadata and must never reclassify a selection. In particular, `/weapons-of-war/shield` does not make a Shield a weapon.

## Required flow

1. **Source adapter** — normalize OWB data into typed Old.dex selections without UI assumptions.
2. **Selection engine** — hold one canonical selection state for weapons, equipment, roles, mounts, counts, magic and lore choices.
3. **Profile engine** — resolve model profiles from base profile + selected persistent effects. Armour replacement is applied before Shield/Armoured Hide modifiers. Temporary weapon/phase effects remain contextual.
4. **Roster engine** — calculate points, composition and validation from the same canonical selection state.
5. **Rule engine** — resolve one canonical rule identity/text record and reuse it everywhere.
6. **Match engine** — consume canonical roster/rule data. Match screens never scrape prose independently to infer basic roster semantics.
7. **Views** — render state and dispatch user choices. Views do not own rule parsing or profile mechanics.

## Compatibility boundaries

Legacy `src/domain/*` and `src/services/*` entry points may remain as thin facades while views migrate, but they must delegate to the canonical core and must not duplicate mechanics.

## Regression rule

Every structural bug must gain a core regression. The canonical Shield regression is:

- Black Orc Bigboss source option `Shield` stays equipment.
- It never appears in `PrototypeWeapon[]`.
- Full Plate Armour provides 4+.
- Selecting Shield improves the eligible rider profile to 3+.

If a bug can only be fixed by adding a version-suffixed runtime service or stylesheet, the fix belongs in a lower core layer instead.
