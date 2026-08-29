# Old.dex Alpha 0.50

Alpha 0.50 is a no-feature maintenance release. It addresses the repository-wide technician audit after Alpha 0.49 and tightens the canonical architecture without changing the intended roster, rules, or match workflows.

## Architecture and validation
- Routed Dropbox OAuth/API/content/revoke requests through the shared HTTP timeout/error boundary. Provider error bodies can still be inspected without bypassing Old.dex networking.
- Returned `matchGuidance.ts` and `matchRosterProfiles.ts` to thin compatibility facades. Charge/use-limit mechanics now live in `matchIntelligence.ts`; magical profile effects live in `matchUnitProfiles.ts`.
- Consolidated all runtime CSS into `src/styles.css`, removed the obsolete broad Dark Mode pill override, and reduced legacy `!important` usage from 186 runtime declarations to 81.
- Expanded static analysis to check all runtime CSS, compatibility-facade ownership, service-worker precache assets, dead infrastructure, repository hygiene, network/storage boundaries, dependency cycles, and existing canonical semantics.

## Repository cleanup
- Removed the obsolete standalone review/preview scripts and their package commands.
- Removed the unused `BootAudioSetting.vue` and `SegmentTabs.vue` components plus the placeholder `ArmyView.vue` route/view.
- Added `.gitignore` for dependencies, builds, Vercel state, local environment files, logs, editor files, generated previews, and ZIP artifacts.
- Removed the nonexistent bundled OWB catalog from the PWA/core fallback contract. Live OWB refresh remains authoritative and the last successful catalog remains persisted locally for offline fallback after an online load.

## Runtime maintenance
- Replaced the placeholder Report control with a GitHub issue workflow prefilled with the current build, page, browser, and recent local diagnostics.
- Centralized the Old.dex runtime build number in `src/version.ts`.
- Documented the saved-roster export schema version as separate from the application build version; the existing `0.65` schema identifier is retained for compatibility.
- Consolidated Alpha 0.43 onward back into the canonical changelog and removed the recent-changelog sidecar.
- Updated the core architecture document to record the network, storage, style, versioning, PWA, and Match facade boundaries.

## Validation
- Core regressions: 43/43 passed.
- Match/maintenance regressions: 66/66 passed.
- Static analysis: passed with 106 source files checked, 81 `!important` declarations, and zero style-version markers.
- Strict TypeScript semantic checking of the changed non-Vue service/core files passed using the repository TypeScript version and audit-only framework declarations.
- Full `vue-tsc`/Vite validation still requires installing the declared project dependencies; dependency installation is unavailable in the current audit environment.

## External validation still required
- A trustworthy `package-lock.json` could not be generated because the npm registry is unavailable in the audit environment. The direct dependency versions remain pinned exactly in `package.json`.
- The full `vue-tsc` and Vite production build could not run without the project dependencies. `npm run check` now passes lint and all 109 regressions, then stops only because `vue-tsc` is not installed in this isolated environment.
- The connected Vercel account exposes the Olddex team but no project through the connector, so production deployment/runtime logs could not be inspected as part of this maintenance pass.
