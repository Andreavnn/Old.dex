# Old.dex GUI v0.63

Old.dex is an alpha Warhammer: The Old World army-roster, rules-reference, and match-companion application. The Vue/TypeScript application in `src/` is the implementation source used by the hosted build.

> Work in progress: some features may be incomplete or produce errors while the application is under active development.

## Current build

Alpha Build 0.63 rebuilds the game-data identity layer around the same Old World Builder resources Old World Builder itself uses: its structured army JSON, exported rules index, supplemental rule map, synonym table, and rule-name normalization. Old.dex now resolves units, mounts, weapons, and special rules through that canonical map before using TOW page reading as detail enrichment.

Unit and mount profiles prefer Old World Builder's indexed statistics. Army-composition overrides remain authoritative, punctuation-aware source parsing avoids corrupting canonical names, and the data layer includes a whole-army reference audit for unresolved entities.

The footer language selector is now connected to Old World Builder's localized source fields. Where OWB provides localized names/text, Army Roster building, model profiles, and roster views reload using the chosen language while preserving stable English source identities internally for rules and selection logic.

## Install as an app

Old.dex ships as a Progressive Web App. On supported desktop and Android browsers, use Install Old.dex from the site/browser controls. On iPhone/iPad, use the browser Share menu and Add to Home Screen.

## Canonical changelog

The full duplicate-free project history is maintained in [`CHANGELOG.md`](CHANGELOG.md). The in-app Changelog uses the matching entries in `src/data/changelog.ts`; these histories should be updated together.

## Data model

Old.dex uses Old World Builder's structured The Old World data and rule-index resolver as the primary identity layer. TOW rules pages are read only after the canonical entity/path has been resolved, chiefly to obtain rule prose, weapon-table details, and other presentation metadata that OWB normally opens in its rules viewer.

## Development

```bash
npm install
npm run check
npm run dev
```

Vercel builds the repository source directly for the hosted application.
