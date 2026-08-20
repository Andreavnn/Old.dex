# Old.dex GUI v0.61

Old.dex is an alpha Warhammer: The Old World army-list and rules-reference application. The Vue/TypeScript application in `src/` is the only implementation source; Vercel builds that source directly for the hosted review site.

> Work in progress: some features may be incomplete or produce errors while the application is under active development.

## Current build

Alpha Build 0.61 makes enemy rosters read-only, adds targeted local-data clearing controls, corrects Games/Support presentation, strengthens roster-state coloring, and improves weapon-reference ingestion so canonical Weapons of War data is preferred while transport gaps are handled without turning Notes/reference-table links into false special rules.

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
