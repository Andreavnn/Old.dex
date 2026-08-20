# Old.dex GUI v0.62

Old.dex is an alpha Warhammer: The Old World army-list and rules-reference application. The Vue/TypeScript application in `src/` is the only implementation source; Vercel builds that source directly for the hosted review site.

> Work in progress: some features may be incomplete or produce errors while the application is under active development.

## Current build

Alpha Build 0.62 adds installable-app support using the Old.dex icon, tightens roster/Support presentation, hardens source-rule extraction against metadata and flavour text, hides unaffordable magical items, and begins the guided match assistant with detailed Setup and Overview steps for rosters, Wizards, Priests, lores, spells, prayers, and contextual Tips.

## Install as an app

Old.dex now ships as a Progressive Web App. On supported desktop and Android browsers, use Settings → Display → Install Old.dex or the browser install control. On iPhone/iPad, use the browser Share menu and Add to Home Screen. Installed copies use the Old.dex crest artwork supplied for this build.

## Canonical changelog

The full duplicate-free history from Alpha Build 0.01 through the current build is maintained in [`CHANGELOG.md`](CHANGELOG.md). The in-app Changelog uses the same entries from `src/data/changelog.ts`; these two histories should be updated together.

## Review and deployment workflow

1. Make application changes in the canonical Vue/TypeScript source.
2. Run static analysis, regression tests, type checking, and the production build.
3. Commit source changes to `Andreavnn/Old.dex`.
4. Vercel builds `main` and updates the hosted review application.

Standalone preview output, when generated, is a disposable build artifact and must never be used as an implementation layer.

## Development

```bash
npm install
npm run check
npm run dev
```

The production review surface is the Vercel deployment built from the repository source.
