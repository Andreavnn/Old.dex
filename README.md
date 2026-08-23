# Old.dex

**Old.dex** is an unofficial companion web app for **Warhammer: The Old World** focused on army building, rules reference, roster validation, and guided match play.

Current public version: **Alpha Build 0.32**

## What Old.dex Does

Old.dex combines several tools into one browser-based application:

- Build and manage Warhammer: The Old World army rosters.
- Validate army composition, category percentages, unit restrictions, and roster requirements.
- Display unit and model profiles, equipment, weapons, saves, mounts, and special rules.
- Keep rider, mount, crew, and other model profiles distinct where appropriate.
- Apply persistent model changes without incorrectly folding temporary weapon or phase effects into base characteristics.
- Import and export Old.dex roster JSON.
- Import supported Old World Builder data.
- Import custom unit data and use custom units in their appropriate roster categories.
- Save friendly and enemy rosters separately.
- Lock completed rosters against accidental editing.
- Start and track games using saved rosters.
- Guide players through setup, deployment, phases, charge tests, spells, special rules, and end-of-round steps.
- Track optional phase actions and required-charge results during matches.
- Install as a Progressive Web App on supported desktop and mobile browsers.

## Current Alpha Focus

Old.dex is still under active development. Current work is focused primarily on:

1. Rules and profile accuracy.
2. Reliable army-composition validation.
3. Canonical model/profile identity.
4. Better handling of mounts, equipment, saves, and persistent modifiers.
5. Custom-unit support.
6. Guided match-flow tools.
7. Mobile and tablet usability.

The project deliberately favors **failing closed rather than guessing** when a model profile or source rule cannot be resolved with sufficient confidence.

## Custom Units

Old.dex supports custom JSON unit data.

Custom units:

- Are visibly marked **CUSTOM**.
- Appear in their actual roster category, such as Characters, Core, Special, or Rare.
- Remain gated behind the **Allow Custom Units** battle-composition option.
- Must provide a recognized faction and a complete base profile containing:

`M / WS / BS / S / T / W / I / A / Ld`

Custom data can be imported from the roster workflow or from the Data & Content section in Settings.

Alpha Build 0.32 also includes a bundled custom **Grimgor Ironhide** implementation for Orc & Goblin Tribes.

## Data and Rules Sources

Old.dex uses and normalizes publicly available community rules data, including data originating from the **Old World Builder** and the **Warhammer Fantasy Online Rules Index Project**.

Old.dex does not treat every imported value as authoritative automatically. The application contains additional resolution, normalization, validation, and profile-identity logic intended to prevent equipment, mount, weapon, or alternate-profile information from incorrectly overwriting a model's canonical base characteristics.

Special thanks to the maintainers and contributors of those community resources, including **Nico Thiebes** and the Old World Builder project.

## Development

Old.dex is built with:

- Vue 3
- Vue Router
- TypeScript
- Vite

### Requirements

- Node.js 22
- npm 10

### Local Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
```

### Type Check

```bash
npm run typecheck
```

### Static Analysis

```bash
npm run lint
```

## Project Status

Old.dex is an **alpha** project. Features, stored-data formats, validation behavior, and UI flows may change between builds.

If using Old.dex during a game or when preparing an event roster, verify disputed rules against the current official Warhammer: The Old World publications, FAQs, and errata.

See [CHANGELOG.md](CHANGELOG.md) for the current development history.

## Disclaimer

Old.dex is an unofficial, non-commercial fan-made project and is not affiliated with, endorsed by, or sponsored by Games Workshop.

**Warhammer**, **Warhammer: The Old World**, and related names, characters, factions, imagery, and trademarks are the property of their respective rights holders.

Community rules data and reference material remain the work of their respective projects and contributors.
