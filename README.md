# Old.dex GUI v0.64

Old.dex is an alpha Warhammer: The Old World army-roster, rules-reference, and match-companion application. The Vue/TypeScript application in `src/` is the implementation source used by the hosted build.

> Work in progress: some features may be incomplete or produce errors while the application is under active development.

## Current build

Alpha Build 0.64 builds on the Old World Builder-aligned data resolver with stricter Wizard lore selection, mount-to-rider Wound propagation, roster validation at match creation, persistent round-count setup, friendly deployment guidance with formations/reserves, and dynamic Start of Round rule checks across both rosters and battle sources.

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
