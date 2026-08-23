import type { ChangelogEntry } from './changelog'

export const changelogV033: ChangelogEntry = {
  version: '0.33',
  title: 'Subphase routing, roster allowances, Legacy armies, and Combat tracking',
  notes: [
    'Separated Create Army Roster choices into Official Armies and Legacy Armies, removed Renegade Crowns as an independent selector choice while preserving its data identity, and added a LEGACY pill to saved Legacy rosters.',
    'Added an explicit approval control for otherwise-valid rosters that still have unused magical-item allowance points; approval is tied to the exact remaining allowance state and automatically expires when those allowances change.',
    'Stopped unselected optional upgrades from creating magical-item allowance warnings, including potential Magic Standard allowances that do not exist until the relevant Standard Bearer or other granting option is actually selected.',
    'Reworked profile-role handling around Unit Models, Champion, Special Model and Mount so unit-wide upgrades and persistent characteristic modifiers are applied to the models they actually affect rather than leaking to only a champion or to unrelated profiles.',
    'Added a subphase timing resolver that gives explicit rule-text timing precedence over broad phase wording, preventing rules such as Rallying Cry from appearing in Command when they resolve during Rallying Fleeing Troops.',
    'Rebuilt in-match phase navigation around separate major-phase and numbered subphase rows, clearer current-step context, mobile horizontal scrolling and persistent Back/Next controls.',
    'Moved battle scenario and other shared battle rules to the top of the current phase/subphase task stack and changed scenario/rule guidance to expandable inline rule panels.',
    'Reworked Required Charge Test so special rules appear first, the Multiple Units wording is removed, and affected units with Pass/Fail controls are listed separately at the bottom.',
    'Expanded Combat with available Assailment spells and their casters plus a per-unit completion checklist for Combat rolls.',
    'Added a match-layout spacing pass for wrapped labels, rule cards, phase controls and mobile task panels.',
    'Added the Olddex Games Workshop / BSData disclaimer to every application page except the splash screen.',
  ],
}
