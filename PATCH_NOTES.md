# Old.dex Alpha 0.49

Alpha 0.49 is a Match stability pass focused on deployment state, charge guidance, shooting/profile hydration, and responsive end-of-round layout.

## Match fixes
- War Machines now remain separate roster entries during Deployment Step 2. Deploying or reserving one War Machine no longer changes every War Machine in the roster.
- The Miscast table no longer exposes its `2D6 / Result` heading row as a selectable outcome.
- Declare Charges now uses `Stay` for the non-charge state while rules-defined Hold charge reactions remain unchanged.
- `MUST CHARGE IF POSSIBLE` is emphasized in orange and the redundant optional charge instruction is removed.
- Charge rows now show the actual detected roll-modifier chain, for example `Charge Roll > +D6 > +D3` for Swiftstride plus Waaagh! Banner.
- Joined Characters and host units no longer repeat the same charge/reaction Special Rule when both possess it.
- Shooting and match profiles now preserve source-linked Warbows and other weapon upgrades from the saved roster snapshot, including compatibility fallbacks for older selection/count storage.
- Failed profile hydration can retry instead of leaving a unit permanently absent from Shooting/profile-dependent match tools.
- Match roster profile rows now show model quantities. Champion and special-model selections are counted separately and mounted profiles represent one mount per mounted model where appropriate.
- Corrected the canonical profile-role heuristic so rider profiles whose names contain mount words (for example Boar Boy) are treated as riders rather than mounts; true mount rows such as War Boar remain mounts. This also restores rider-targeted persistent equipment/profile effects.
- End of Round Step 2 now owns a responsive score/action layout so Round & Score Calculation cannot overlap its four controls.

## Stability review
- Confirmed Warbow/Warbows already belong to the canonical missile-weapon vocabulary; the missing-shooter defect was downstream roster hydration, which is corrected at the shared match-profile adapter.
- Kept declaration-range calculation and charge-roll modifiers separate while exposing both from the same active-rule/item contribution set.
- Added regression coverage for per-unit War Machine deployment, Miscast header filtering, stacked charge-roll display, joined-rule deduplication, weapon snapshot hydration, profile quantities, and responsive score geometry.
- Checked the repository for obsolete ODX verification markers; none are present in the current source.

## Release
- Updated package, header, footer, Settings changelog label, Share Code metadata, changelog, and PWA cache to Alpha Build 0.49.
