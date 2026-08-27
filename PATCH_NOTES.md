# Old.dex Alpha 0.46

Alpha 0.46 returns match spell presentation to Old.dex's canonical rule cards and tightens match-state controls, deployment order, and roster actions.

## Match
- Setup Step 2 spells now use the same `RuleAbilityCard` presentation as Special Rules and Magical Items, with only the Select control added for spell generation.
- Spells shown in their castable phase/subphase use the same canonical rule box and now have mutually exclusive Successful / Failed tracking.
- Deployment Step 2 now enforces the displayed order: ordinary units, War Machines, Characters, then Scouts / special deployment. Later groups remain locked until earlier groups are resolved or placed in Reserve.
- Disruptive Weather uses the standard expandable match rule-panel presentation while retaining the required D6 result and progression gate.
- Corrected the Tips master flip switch so generic checkbox sizing no longer overrides it.
- Reduced and bounded the Back / Next controls so they stay inside the match panel.
- Combat Step 1 marks units that successfully charged with a `Charged` status.
- Depleted limited-use rules/items lock their tracking checkbox.
- Movement Step 2 adds `In Combat`. Hold and In Combat exclude all charge actions; charge actions lock Hold and In Combat.

## Army Rosters
- Reworked roster-entry actions into the compact square button layout: Export, Lock, Enemy toggle, Copy, Share Code, and Delete where applicable.
- Kept the QR-shaped roster icon as the Share Code action only; no QR generation or scanning is reintroduced.
- Added direct per-roster Delete with confirmation.

## Release
- Updated package, header, footer, changelog, and PWA cache metadata to Alpha Build 0.46.
- Expanded permanent match regressions for canonical spell cards, cast results, deployment gating, charge-state exclusivity, depleted-use locking, compact navigation, Combat charge carry-through, and roster actions.
