import type { ChangelogEntry } from './changelog'

export const latestChangelogEntry: ChangelogEntry = {
  version: '0.45',
  title: 'Settings cleanup, Share Codes, rule resolution, and match UI refinement',
  notes: [
    'Reworked Settings rows to match the clearer Brambleheart presentation while preserving Old.dex Reset Local Data behavior, moved Site Changelog into Changelog & Updates, and removed underlines from download-style controls.',
    'Renamed Install to Access & Community, added Discord and Share actions in Settings and the global footer, moved Launch Audio above Themes, and simplified Donation controls.',
    'Replaced QR roster transfer with Old.dex Share Codes. QR generation, camera/image scanning, and QR-only dependencies are removed; the familiar QR-shaped roster-row icon now opens Share Code sharing instead.',
    'Share Codes are staged locally for review on the short /lists/shared route, including legacy payload links which have their long hash removed from the address bar after receipt. Roster import/export remain compact file transfer actions and Custom Data import remains in Settings.',
    'Hardened magic-item source resolution so exact item boundaries are respected on collection pages, non-weapon items no longer trigger unnecessary broad fallbacks, and collection-only items can still resolve when an individual route is missing.',
    'Changed the match Tips master control to a flip switch while retaining individual Tip checkboxes.',
    'Added a shared match-content gutter so text and controls no longer sit directly against panel borders across setup, deployment, phase, and combat surfaces.',
    'Reduced Setup spell-card Select, metadata, rule-link, and body text sizes; moved type/signature pills below the spell name; and normalized spell icon sizing.',
    'Restored Disruptive Weather as an always-visible required pre-deployment D6 table with inline rules access, saved result selection, and progression gating until a result is recorded.',
    'Bumped package/header/footer/PWA metadata to Alpha Build 0.45 and extended permanent regressions for the new UI and rule-resolution behavior.',
  ],
}
