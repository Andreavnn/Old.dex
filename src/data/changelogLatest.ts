import type { ChangelogEntry } from './changelog'

export const latestChangelogEntry: ChangelogEntry = {
  version: '0.44',
  title: 'Roster sharing, Dropbox sync, spell recovery, and match-flow refinement',
  notes: [
    'Added versioned local roster sharing through compressed URL payloads, locally generated QR codes, Copy Link and native Share. Shared links open read-only and are never saved until the receiving player explicitly chooses Add to My Rosters.',
    'Added optional Dropbox App Folder cloud storage for army rosters using OAuth 2 Authorization Code with PKCE, matching Brambleheart’s local-first manual-sync architecture. Update from Cloud, Upload Local and Disconnect are explicit actions; there is no background polling.',
    'Rebuilt Setup spell presentation and added canonical spell-detail recovery so generated spell cards include their type, Casting Value, Range and effect even when the lore transport flattened its markup. Enriched selected spells are persisted and route into their correct later subphases.',
    'Removed the Match Note field from guided match pages.',
    'Changed Battle March deployment handling so Disruptive Weather is a closed pre-deployment reference whose D6 result is required before progression, while Wilderness Terrain appears only at the end of Deploy Armies and as a closed reminder beneath later phase Tips.',
    'Corrected Chaos of War ownership and recurrence: only the player who took first turn sees it from round 2 onward, prior table results cannot be reused, and the panel now displays the requested source-rule procedure text.',
    'Removed the 0-inch value from Hold in Remaining Moves.',
    'Added calculated Shooting To Hit targets beside BS, including cumulative common modifiers, 7+ follow-up rolls, BS6+ re-roll values, and expandable per-profile Ballistic Skills for mixed units.',
    'Separated Combat Step 1 checkbox interaction from unit-profile navigation, centered match-profile model names, removed magical-item point costs from match profiles, corrected joined-unit spacing, and renamed the joined-character Combat Result notice.',
    'Expanded Dark Mode pill and chip contrast fixes across match profiles, spell cards and neutral option surfaces.',
    'Bumped package/header/footer/PWA cache metadata to Alpha Build 0.44 and expanded permanent match regressions for the new sharing, cloud, spell, Battle Condition, Shooting and Combat behavior.',
  ],
}
