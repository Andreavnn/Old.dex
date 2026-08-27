# Old.dex Alpha Build 0.43

Alpha Build 0.43 is a normal Old.dex source patch built for the current Alpha Build 0.42 repository. The package contains finished changed/new files in their repository paths; it contains no patch runner, payload manifest, verification marker, or GitHub workflow artifact.

## Match and rules changes

- Corrects Dark Mode pill/chip readability and keeps Combat Result/score steppers theme-safe.
- Keeps Battle Conditions selectable during Setup without expanding their rule tables there.
- Resolves Disruptive Weather and Wilderness Terrain at the start of Deployment, with the rolled result recorded and shown where it applies.
- Resolves Chaos of War from each player's second turn onward and records the result by turn context.
- Replaces the Setup spell-choice renderer with a shared canonical spell box.
- Groups Deployment entries in visible placement order: ordinary units, War Machines, Characters, then Scouts/special deployment.
- Adds Leadership to Required Charge Test unit presentation.
- Uses roster-derived Movement values in Remaining Moves instead of "See profile" when the saved match profile can resolve M.
- Adds BS to Shooting and selectable To Hit penalty controls.
- Adds a dedicated match-roster profile route built from the roster snapshot saved when the match began; the full Choose & Fight Combat unit panel opens that profile.
- Tracks limited-use rules by actual use count and scope instead of subtracting uses merely because a round advanced.
- Persists charge/combat history and fleeing state across turns/rounds; fleeing units surface for Rally/compulsory movement until resolved.
- Changes single-model Combat status to `X Wounds Remaining`.
- Rebuilds maximum declaration range as named active contributions. Example: `Maximum declaration range: M 7 + 6 + 3 Swiftstride + 3 Waaagh! Banner = 19"`.
- Hardens Match layout shrink/wrapping rules so nested panels remain inside the main Match surface.

## Regression coverage

The permanent `scripts/match-regression.mjs` suite covers named charge-source stacking/removal, limited-use scopes, persistent match state, match-snapshot profile routing, shared spell boxes, Dark Mode pill correction, Shooting BS/penalties, single-model Wounds Remaining, and Battle Condition timing.

Alpha Build metadata is updated to 0.43 in the package, header, installed-app launch/footer, README, and PWA cache.
