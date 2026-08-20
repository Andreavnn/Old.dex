import { readJson, writeJson } from './storage'
import type { SavedArmyList } from './savedLists'
import type { BuilderRosterSelection } from '../domain/rosterTypes'

export type GameStatus = 'open' | 'complete'
export type GameSide = 'player' | 'opponent'
export type GameOutcome = 'completed' | 'conceded' | 'enemy-yielded' | 'draw'

export type GameScenarioGuidance = {
  sourcePath: string
  roundLimit: number
  gameLength: string
  setupText: string
  scenarioRules: string[]
  specificTerrain: boolean
}


export type GameMagicChoice = {
  id: string
  name: string
  summary?: string
  path?: string
  signature?: boolean
}

export type GameMagicCaster = {
  instanceId: string
  unitId: string
  name: string
  kind: 'Wizard' | 'Priest'
  level: number
  availableLores: string[]
  selectedLore: string
  selectedSpellIds: string[]
  choices?: GameMagicChoice[]
  sourceLoaded?: boolean
}

export type GameWorkflowStep = { id: string; label: string; description: string }
export type GameWorkflowPhase = { id: string; label: string; steps: GameWorkflowStep[] }

export const gameWorkflow: GameWorkflowPhase[] = [
  { id: 'setup', label: 'Setup', steps: [
    { id: 'armies-battle', label: 'Armies & Battle', description: 'Confirm the participating army lists, battle format and selected scenario.' },
    { id: 'spells', label: 'Spells', description: 'Confirm each Wizard or Priest lore and the spells or prayers that will be used before deployment.' },
  ] },
  { id: 'overview', label: 'Overview', steps: [
    { id: 'battle-overview', label: 'Battle Overview', description: 'Review the current battle state, score, active effects and saved round history.' },
  ] },
  { id: 'deployment', label: 'Deployment', steps: [
    { id: 'deployment-order', label: 'Deployment Order', description: 'Record which player starts alternating deployment.' },
    { id: 'deploy-armies', label: 'Deploy Armies', description: 'Deploy units, record reserves and note joined characters.' },
    { id: 'first-turn', label: 'First Turn', description: 'Resolve and record the first-turn roll after deployment is complete.' },
  ] },
  { id: 'strategy', label: 'Strategy', steps: [
    { id: 'start-of-turn', label: 'Start of Turn', description: 'Resolve mandatory Start of Turn actions and active Magical Vortex movement.' },
    { id: 'command', label: 'Command', description: 'Resolve Command sub-phase abilities and usable magical items.' },
    { id: 'conjuration', label: 'Conjuration', description: 'Resolve eligible Enchantment and Hex spells.' },
    { id: 'rally', label: 'Rally Fleeing Troops', description: 'Resolve required Rally tests for fleeing friendly units.' },
  ] },
  { id: 'movement', label: 'Movement', steps: [
    { id: 'required-charges', label: 'Required Charge Tests', description: 'Resolve compulsory charge checks such as Impetuous before declaring charges.' },
    { id: 'declare-charges', label: 'Declare Charges', description: 'Declare eligible charges and record required charge declarations.' },
    { id: 'charge-moves', label: 'Charge Moves', description: 'Resolve declared charges and record successful or failed charge movement.' },
    { id: 'compulsory-moves', label: 'Compulsory Moves', description: 'Resolve fleeing movement, reserves and other compulsory movement.' },
    { id: 'remaining-moves', label: 'Remaining Moves', description: 'Resolve normal movement, marching and eligible Conveyance spells.' },
  ] },
  { id: 'shooting', label: 'Shooting', steps: [
    { id: 'special-shooting', label: 'Special Shooting Actions', description: 'Resolve Shooting-phase spells and other special actions.' },
    { id: 'shooting', label: 'Shooting', description: 'Resolve eligible missile attacks using the current weapon and profile information.' },
  ] },
  { id: 'combat', label: 'Combat', steps: [
    { id: 'fight', label: 'Choose & Fight Combat', description: 'Resolve attacking and being attacked in Initiative order.' },
    { id: 'combat-result', label: 'Calculate Combat Result', description: 'Record Combat Result and determine the winning side.' },
    { id: 'break-test', label: 'Break Test', description: 'Resolve any required Break Test and record the outcome.' },
    { id: 'follow-up', label: 'Follow Up & Pursuit', description: 'Resolve follow up, pursuit, restraint and fleeing movement.' },
  ] },
  { id: 'end', label: 'End', steps: [
    { id: 'end-turn', label: 'End of Turn', description: 'Record scoring and persistent effects, then advance to the next side or round.' },
  ] },
]

export type SavedGame = {
  id: string
  status: GameStatus
  name: string
  playerListId: string
  playerListName: string
  playerArmyName: string
  playerName: string
  playerArmyId?: string
  playerCompositionName?: string
  playerCompositionRule?: string
  playerOptions?: string[]
  playerRoster?: BuilderRosterSelection[]
  opponentListId?: string
  opponentListName?: string
  opponentArmyName?: string
  opponentArmyId?: string
  opponentCompositionName?: string
  opponentCompositionRule?: string
  opponentOptions?: string[]
  opponentRoster?: BuilderRosterSelection[]
  opponentName: string
  magicSetup?: GameMagicCaster[]
  playerPoints: number
  opponentPoints: number
  points: number
  scenario: string
  scenarioGuidance?: GameScenarioGuidance
  battlefieldConditions?: string[]
  roundLimit: number
  roundsCompleted: number
  battleStarted: boolean
  outcome?: GameOutcome
  firstPlayer: GameSide
  firstPlayerConfirmed: boolean
  round: number
  activeSide: GameSide
  phaseIndex: number
  stepIndex: number
  stepNotes: Record<string, string>
  playerScore: number
  opponentScore: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

const KEY = 'olddex.games.v1'

function parseGames(value: unknown): SavedGame[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is SavedGame => Boolean(row && typeof row === 'object' && typeof (row as SavedGame).id === 'string')).map((row) => ({
    ...row,
    status: row.status === 'complete' ? 'complete' : 'open',
    round: Math.max(1, Number(row.round || 1)),
    phaseIndex: Math.max(0, Math.min(gameWorkflow.length - 1, Number(row.phaseIndex || 0))),
    stepIndex: Math.max(0, Number(row.stepIndex || 0)),
    stepNotes: { ...(row.stepNotes || {}) },
    playerScore: Math.max(0, Number(row.playerScore || 0)),
    opponentScore: Math.max(0, Number(row.opponentScore || 0)),
    firstPlayerConfirmed: typeof row.firstPlayerConfirmed === 'boolean' ? row.firstPlayerConfirmed : true,
    playerPoints: Math.max(0, Number(row.playerPoints || row.points || 0)),
    opponentPoints: Math.max(0, Number(row.opponentPoints || 0)),
    roundLimit: Math.max(1, Number(row.roundLimit || row.scenarioGuidance?.roundLimit || 6)),
    roundsCompleted: Math.max(0, Number(row.roundsCompleted || 0)),
    battleStarted: Boolean(row.battleStarted || Number(row.roundsCompleted || 0) > 0 || Number(row.round || 1) > 1),
    battlefieldConditions: Array.isArray(row.battlefieldConditions) ? [...row.battlefieldConditions] : [],
    scenarioGuidance: row.scenarioGuidance ? { ...row.scenarioGuidance, scenarioRules: [...(row.scenarioGuidance.scenarioRules || [])] } : undefined,
    outcome: ['completed', 'conceded', 'enemy-yielded', 'draw'].includes(String(row.outcome)) ? row.outcome : undefined,
    playerName: String(row.playerName || 'Friendly General'),
    playerOptions: Array.isArray(row.playerOptions) ? [...row.playerOptions] : [],
    opponentOptions: Array.isArray(row.opponentOptions) ? [...row.opponentOptions] : [],
    playerRoster: Array.isArray(row.playerRoster) ? row.playerRoster.map((entry) => ({ ...entry })) : [],
    opponentRoster: Array.isArray(row.opponentRoster) ? row.opponentRoster.map((entry) => ({ ...entry })) : [],
    magicSetup: Array.isArray(row.magicSetup) ? row.magicSetup.map((entry) => ({ ...entry, availableLores: [...(entry.availableLores || [])], selectedSpellIds: [...(entry.selectedSpellIds || [])], choices: entry.choices?.map((choice) => ({ ...choice })) })) : [],
  }))
}

function readAll() { return readJson(KEY, parseGames, []) }
function writeAll(rows: SavedGame[]) { return writeJson(KEY, rows) }

export function getSavedGames() {
  return readAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}


export function clearSavedGamesByStatus(status: GameStatus) {
  const rows = readAll()
  const next = rows.filter((game) => game.status !== status)
  writeAll(next)
  return rows.length - next.length
}

export function getSavedGame(id: string) { return getSavedGames().find((game) => game.id === id) || null }

function rosterActualPoints(list: SavedArmyList | null | undefined) {
  if (!list) return 0
  const saved = Number(list.actualPoints || 0)
  if (saved > 0) return saved
  const roster = (list.roster || []).reduce((sum, row) => sum + Number(row.totalPoints || 0), 0)
  return roster > 0 ? roster : Math.max(0, Number(list.points || 0))
}

export function createSavedGame(input: {
  playerList: SavedArmyList
  opponentList?: SavedArmyList | null
  playerName?: string
  opponentName?: string
  scenario: string
}) {
  const now = new Date().toISOString()
  const playerName = input.playerName?.trim() || 'Friendly General'
  const opponentName = input.opponentName?.trim() || 'Enemy General'
  const game: SavedGame = {
    id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'open',
    name: `${playerName} - ${opponentName}`,
    playerListId: input.playerList.id,
    playerListName: input.playerList.name,
    playerArmyName: input.playerList.armyName,
    playerName,
    playerArmyId: input.playerList.army,
    playerCompositionName: input.playerList.compositionName,
    playerCompositionRule: input.playerList.rule,
    playerOptions: [...(input.playerList.options || [])],
    playerRoster: (input.playerList.roster || []).map((entry) => ({ ...entry })),
    opponentListId: input.opponentList?.id,
    opponentListName: input.opponentList?.name,
    opponentArmyName: input.opponentList?.armyName,
    opponentArmyId: input.opponentList?.army,
    opponentCompositionName: input.opponentList?.compositionName,
    opponentCompositionRule: input.opponentList?.rule,
    opponentOptions: [...(input.opponentList?.options || [])],
    opponentRoster: (input.opponentList?.roster || []).map((entry) => ({ ...entry })),
    opponentName,
    magicSetup: [],
    playerPoints: rosterActualPoints(input.playerList),
    opponentPoints: rosterActualPoints(input.opponentList),
    points: Math.max(input.playerList.points, input.opponentList?.points || 0),
    scenario: input.scenario || 'Open Battle',
    battlefieldConditions: [],
    roundLimit: 6,
    roundsCompleted: 0,
    battleStarted: false,
    firstPlayer: 'player',
    firstPlayerConfirmed: false,
    round: 1,
    activeSide: 'player',
    phaseIndex: 0,
    stepIndex: 0,
    stepNotes: {},
    playerScore: 0,
    opponentScore: 0,
    createdAt: now,
    updatedAt: now,
  }
  writeAll([game, ...readAll()])
  return game
}

export function updateSavedGame(id: string, patch: Partial<Omit<SavedGame, 'id' | 'createdAt'>>) {
  const rows = readAll()
  const game = rows.find((row) => row.id === id)
  if (!game) return null
  Object.assign(game, patch, { updatedAt: new Date().toISOString() })
  writeAll(rows)
  return game
}

export function completeSavedGame(id: string, outcome: GameOutcome = 'completed') {
  return updateSavedGame(id, { status: 'complete', outcome, completedAt: new Date().toISOString() })
}

export function deleteSavedGame(id: string) {
  const rows = readAll()
  const next = rows.filter((game) => game.id !== id)
  writeAll(next)
  return next.length !== rows.length
}

export function resetSavedGame(id: string) {
  return updateSavedGame(id, {
    status: 'open',
    outcome: undefined,
    completedAt: undefined,
    firstPlayer: 'player',
    firstPlayerConfirmed: false,
    round: 1,
    roundsCompleted: 0,
    battleStarted: false,
    activeSide: 'player',
    phaseIndex: 0,
    stepIndex: 0,
    stepNotes: {},
    playerScore: 0,
    opponentScore: 0,
    magicSetup: [],
  })
}
