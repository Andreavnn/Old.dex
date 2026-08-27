# Old.dex Alpha 0.47

Alpha 0.47 consolidates roster transfer controls, fixes theme-independent pill presentation, and deepens match-state handling for Battle Conditions, magic, Shooting, Combat Result, and End of Round.

## Army Rosters
- Replaced the My Rosters icon-only transfer controls with word actions.
- Combined roster import into one `Import Roster` action with either JSON file upload or pasted Share Code.
- Combined roster export into one `Export Roster` action with either file download or Share Code sharing.
- Added a left-side roster filter and removed the page-level Delete control.
- Restored saved-roster actions in this order: View, Edit, Lock, Mark Enemy, Copy, Share, Delete.
- Restored the flag icon and `Mark as Enemy Roster` label.
- Moved current/limit points beside the roster name and removed redundant VALID / Locked copy.

## Theme
- Common pill UI now uses fixed semantic foreground/background/border palettes in both Light and Dark modes.
- Magic/rule and roster-status pills retain their intended colors instead of inheriting Dark Mode surface variables.

## Match
- Scenario Game Length defaults to the minimum stated round count when a selected scenario gives a range or minimum, unless the user already customized the round limit.
- Setup spell Select controls sit lower beneath the card accent edge, and spell type is presented below the spell name.
- Added a universal Ongoing Battle Conditions panel at the top of active battle phases; the prior duplicated Wilderness Terrain phase reminders are removed.
- Replaced miniature limited-use pills with larger text-size-aware remaining-use status blocks.
- Added Total Power and Miscast tracking for castable spells. Total Power automatically marks Miscast.
- Miscasts open the source Miscast table inline with selectable results. Results that prevent further casting lock that Wizard for the source-defined phase or turn.
- The miscast tracker also supports source-defined Wizard Level loss and lets the player choose known spells to forget when a level-loss result requires it.
- Shooting weapon profiles are back above To Hit penalty controls.
- Mixed Ballistic Skill details only expand when the unit actually contains more than one distinct BS value.
- Winning Combat Result follow-up choices now use the same card treatment as lost-combat outcomes and include explicit test/roll instructions.
- Round & Score Calculation is flattened into End of Round Step 2 rather than nested in its own panel.

## Release
- Updated package, header, footer, Settings changelog label, Share Code metadata, changelog, and PWA cache to Alpha Build 0.47.
