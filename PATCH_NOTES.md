# Old.dex v0.57 — Canonical Profile Foundation Rebuild

This patch starts the ground-up profile/data rebuild and includes the requested splash/footer cleanup.

## Core profile rules enforced

- Base model characteristics are immutable canonical data.
- Profile identity includes faction, army composition, roster unit, rules unit, exact model/profile, and owner.
- Split profiles are never resolved by blindly taking row 0.
- Characteristic tables must explicitly contain M / WS / BS / S / T / W / I / A / Ld.
- Ambiguous multi-profile sources fail closed instead of guessing.
- Cache identity includes schema/parser version plus source revision/content hash. Path-only profile cache reuse is removed.
- Only match-long model effects may change displayed model stats.
- Armour/save changes may update Sv/Ward/Rn when they persist for the match.
- Weapon-only Strength/AP/Attacks/range/rules remain on the weapon profile.
- Rules affecting all weapons can be represented as weapon-profile modifiers without mutating the model.
- Temporary turn/phase/charge/attack effects cannot enter the persistent model-stat resolver.
- Legacy arbitrary `profileOverride` mutation is restricted to persistent save fields during migration.

This intentionally does not hardcode Shugengan Lord or any other unit. The fix is structural.

## UI cleanup included

- Un-bold `Warhammer Fantasy Online Rules Index Project` and `Nico Thiebes` when wrapped in `<strong>`/`<b>`.
- Remove simple Language selectors/footer controls and hide remaining known language control classes.
- Remove exact-label Donation / Donate / Support splash actions.
- Add an inline Discord icon to Discord buttons/links that do not already have one and center the action area.
- Reduce install-button image size and add internal padding so the icon is not clipped.

## Applying

```bash
python scripts/apply-v057.py /path/to/Old.dex
```

The script is intentionally fail-fast. If the current v0.56 source moved critical integration anchors, it stops instead of silently producing a partial or unsafe patch.

No GitHub apply workflow, verification marker, or temporary CI file is included.

## First acceptance targets

- Shugengan Lord resolves the exact rules-source model row rather than a neighboring/first row.
- Shugengan General and other Cathay character profiles resolve independently.
- Great Spirit Longma remains a separate mount profile.
- Grand Army and Jade Fleet can share a base profile without composition availability/options leaking into characteristics.
- Weapon S/AP modifiers do not change the model's displayed base stats.
- Persistent armour/save changes update the model save.
- Temporary characteristic bonuses remain contextual and do not alter the roster profile.
