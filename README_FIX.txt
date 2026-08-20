Old.dex v0.51 — Roster Edit Freeze Hotfix

Root cause:
The UnitView roster autosave watcher watched selection Set/Map refs, then the autosave function called normalization routines that replaced those same refs. Each save therefore triggered another save indefinitely while in Edit mode, locking the browser tab.

Fix:
- Autosave is now a pure snapshot and never normalizes watched state.
- Selection normalization remains at hydration and user-mutation boundaries.
- Autosave writes are coalesced to one queued next-tick save.
- Added a regression test preventing normalization calls from being reintroduced into autosave.

Files to replace in GitHub main:
  src/views/UnitView.vue
  tests/ui-contract.test.mjs

Verification:
  ODX static analysis: PASS
  Automated tests: 80 passed, 0 failed
