# Old.dex GUI v0.30

Old.dex is an alpha Warhammer: The Old World army-roster, rules-reference, and match-companion application. The Vue/TypeScript application in `src/` is the implementation source used by the hosted build.

> Work in progress: some features may be incomplete or produce errors while the application is under active development.

## Current build

Alpha Build 0.30 tightens match setup and battle guidance around scenario-specific information. Scenario rules now open inside the match, spell selection uses compact expandable spell-detail panels, and selected spells are surfaced again in the exact turn subphase in which their spell type can be cast.

Overview now keeps scenario maps and scenario-specific conditions visible alongside both rosters' composition options. Deployment avoids placeholder formation text, carries the recorded first-player choice into the turn-view filter, and supplies the standard matched-play first-turn roll-off procedure when no scenario-specific procedure is available.

The compact Your Turn / Enemy's Turn controls remain view filters rather than turn-state mutations. Friendly actions are shaded green, enemy-turn reactions are shaded red, and the battle assistant continues to surface dispels and other friendly responses during the opponent's turn.

## Install as an app

Old.dex ships as a Progressive Web App. On supported desktop and Android browsers, use Install Old.dex from the site/browser controls. On iPhone/iPad, use the browser Share menu and Add to Home Screen.

## Canonical changelog

The full project history is maintained in [`CHANGELOG.md`](CHANGELOG.md). The in-app Changelog uses the matching entries in `src/data/changelog.ts`; these histories should be updated together.

## Data model

Old.dex uses Old World Builder's structured The Old World data and rule-index resolver as the primary identity layer. TOW rules pages are read only after the canonical entity/path has been resolved, chiefly to obtain rule prose, weapon-table details, scenario guidance, and other presentation metadata.

## Development

```bash
npm install
npm run check
npm run dev
```

Vercel builds the repository source directly for the hosted application.
