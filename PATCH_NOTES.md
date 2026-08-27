# Old.dex Alpha Build 0.44

Alpha Build 0.44 is a normal Old.dex source patch for the live Alpha Build 0.43 repository. It contains finished changed/new files in their repository paths. There is no patch runner, payload manifest, verification marker, or standalone preview artifact.

## Roster sharing & cloud storage

- Adds local QR-code roster sharing using a versioned, compressed Old.dex roster payload stored in the share URL. No account or Old.dex server is required.
- Adds Share controls to friendly and enemy roster rows with QR code, Copy Link, and native Share when the browser supports it.
- Shared links open a read-only transient roster preview first. Nothing is written locally until the receiving player chooses `Add to My Rosters`.
- Keeps normal JSON export/import unchanged and validates shared payloads through Old.dex roster schema parsing before display or import.
- Adds Dropbox Cloud Sync for army rosters using the same App Folder + OAuth 2 Authorization Code with PKCE architecture used by Brambleheart. Local storage remains authoritative; Dropbox is contacted only through explicit `Update from Cloud` and `Upload Local` actions.
- Dropbox sync uses exact internal roster IDs, `_ODX.json` files, duplicate-ID protection, manual disconnect/revocation, and no background polling. The deployment reads the public Dropbox app key from `VITE_DROPBOX_APP_KEY`.

## Match flow

- Rebuilds Setup spell cards so long names, type, icon, checkbox, Casting Value, Range, and spell effect remain legible. Missing spell metadata is recovered from each spell’s canonical rule page (with lore-page fallback), then persisted in the match snapshot so selected spells appear in their correct later subphases.
- Removes the Match Note field from match pages.
- Makes Deployment Battle Condition references closed by default and persistent across rules navigation.
- Disruptive Weather is the only pre-deployment Battle Condition requiring a recorded D6 result before Old.dex allows progression to Deploy Armies.
- Moves Wilderness Terrain out of Deployment Order. It appears at the end of Deploy Armies and beneath later phase Tips as a closed reference; Old.dex does not require a saved terrain-result checkbox.
- Restricts Chaos of War to the player who took the first turn, from round 2 onward, uses a separate result per round, prevents reusing prior table results, and displays the requested source-rule procedure text.
- Removes `0"` from Hold in Remaining Moves.
- Adds calculated Shooting `To Hit` beside BS, including cumulative common modifiers and BS6+ re-roll targets. Units with multiple Ballistic Skills expose a closed per-model BS/To Hit breakdown.
- Separates the Combat Step 1 checkbox target from the unit profile link so clicking around the checkbox cannot open the profile.
- Centers model names in match snapshot profiles, removes magical-item point costs from match profiles, and corrects joined-unit spacing/text in Combat.
- Replaces the joined-character Combat Result note with `Combat Results Tracked by Joined Unit - X`.
- Expands Dark Mode pill/chip contrast corrections to profile troop-type, option, loadout, rule-type, spell-type, and selection surfaces.

## Regression coverage

- Extends the permanent match regression suite for spell enrichment, Note removal, Battle Condition sequencing, Wilderness Terrain placement, Chaos of War ownership/text, Shooting To Hit calculations, Combat click targets, match-profile presentation, QR roster sharing, transient shared-roster routing, Dropbox manual-sync architecture, and Alpha 0.44 metadata.
