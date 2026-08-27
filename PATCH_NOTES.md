# Old.dex Alpha 0.45 Patch Notes

Alpha 0.45 is a UI and rules-resolution refinement patch built on Alpha 0.44.

## Changes

- Settings Data & Content now uses the clearer row-separated Brambleheart-style presentation while keeping Old.dex Reset Local Data behavior intact.
- Added Changelog & Updates as its own Settings section.
- Access & Community now contains Install Old.dex, Discord, and Share.
- Global page tools now show Report, Discord, Share, and Install Old.dex.
- Launch Audio moved above Themes and uses the requested Murderin' description.
- Donation controls now use the compact Donation / Recurring Support presentation.
- Army Roster import and export actions use compact transfer icons. Custom Data import remains in Settings only.
- Roster sharing now uses Old.dex Share Codes only. QR generation, QR image scanning, camera capture, and their dependencies were removed.
- The roster-row QR-shaped icon is retained as the Share Code action. Received Share Codes are staged locally and reviewed at the short `/lists/shared` URL instead of leaving the encoded roster payload in the address bar.
- Fixed magic-item collection parsing and fallback behavior that could mix unrelated items or miss collection-only rules.
- Tips master control is now a flip switch. Individual Tip completion checkboxes are unchanged.
- Added a shared match-content gutter to keep text away from panel borders.
- Reduced spell-card control/detail text, fixed spell icon sizing, and moved pills below spell names.
- Restored the required Disruptive Weather table/result controls directly in Deployment Step 1 and blocks progression until recorded.

## Validation

- Permanent match/UI regression checks expanded for Alpha 0.45.
- Changed TypeScript/Vue script syntax is checked before packaging.
