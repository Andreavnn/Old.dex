# Old.dex Core Architecture

Old.dex keeps one canonical owner for each kind of application state or mechanic. Maintenance work must change that owning layer rather than adding version-specific compensating patches downstream.

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

## Shared infrastructure boundaries

- **Network:** all application network requests go through `src/services/http.ts`. Provider-specific services may inspect returned non-2xx bodies, but may not call `fetch()` directly.
- **Storage:** all browser local-storage access goes through `src/services/storage.ts`.
- **Styles:** runtime CSS is consolidated in `src/styles.css`. Version-suffixed or feature-sidecar runtime stylesheets are not permitted.
- **Versioning:** the runtime build label lives in `src/version.ts`. File-format/schema versions are separate constants and must not be inferred from the application build number.
- **PWA:** every service-worker core precache entry must correspond to a real public asset.

## Compatibility boundaries

Legacy `src/domain/*` and `src/services/*` entry points may remain as thin facades while views migrate, but they must delegate to the canonical core and must not duplicate mechanics. In particular:

- `services/matchGuidance.ts` is a compatibility facade over `services/matchIntelligence.ts`.
- `services/matchRosterProfiles.ts` is a compatibility facade over `services/matchUnitProfiles.ts`.
- `domain/profileEffects.ts` is a compatibility facade over `core/profileEngine.ts`.

## Regression rule

Every structural bug must gain a core or match regression. The canonical Shield regression is:

- Black Orc Bigboss source option `Shield` stays equipment.
- It never appears in `PrototypeWeapon[]`.
- Full Plate Armour provides 4+.
- Selecting Shield improves the eligible rider profile to 3+.

Repository validation additionally rejects direct network/storage bypasses, dependency cycles, obsolete versioned runtime services, split runtime stylesheets, missing service-worker core assets, and compatibility facades that begin owning mechanics again.

If a bug can only be fixed by adding a version-suffixed runtime service, stylesheet, or delivery-specific layer, the fix belongs in a lower canonical layer instead.
